use std::path::{Path, PathBuf};
use std::process::Command;

// Only public C entry points used by our Rust FFI and swift-rs. Never promote
// compiler-generated helpers or every symbol in dependency objects: that can
// introduce duplicate globals and crash Apple's linker.
const EXPORTS: &[&str] = &[
    "_afmize_availability",
    "_afmize_string_free",
    "_afmize_stream_start",
    "_afmize_stream_cancel",
    "_retain_object",
    "_release_object",
    "_data_from_bytes",
    "_string_from_bytes",
];

pub fn find_archive(root: &Path, configuration: &str, platform: &str) -> Result<PathBuf, String> {
    let mut directories = vec![root.join(configuration)];
    // SwiftPM's Xcode build system uses Products/<Config>-<platform>.
    for base in [root.join("Products"), root.join("out/Products")] {
        if let Ok(entries) = base.read_dir() {
            let expected = format!("{configuration}-{platform}");
            directories.extend(entries.flatten().filter_map(|entry| {
                entry
                    .file_name()
                    .to_str()
                    .is_some_and(|name| {
                        name.eq_ignore_ascii_case(&expected)
                            || (platform == "macosx" && name.eq_ignore_ascii_case(configuration))
                    })
                    .then(|| entry.path())
            }));
        }
    }
    // Legacy SwiftPM layout used by the pinned SwiftLinker on older Xcode.
    let arch = if std::env::consts::ARCH == "aarch64" {
        "arm64"
    } else {
        std::env::consts::ARCH
    };
    directories.push(
        root.join(format!("{arch}-apple-macosx"))
            .join(configuration),
    );
    let mut archives: Vec<_> = directories
        .into_iter()
        .map(|path| path.join("libafmize.a"))
        .filter(|path| path.is_file())
        .map(|path| path.canonicalize().map_err(|error| error.to_string()))
        .collect::<Result<_, _>>()?;
    archives.sort();
    archives.dedup(); // The configuration directory may be a symlink.
    match archives.as_slice() {
        [archive] => Ok(archive.clone()),
        _ => Err(format!(
            "Expected one afmize archive for {configuration}/{platform} under {}, found {archives:?}",
            root.display()
        )),
    }
}

fn output(command: &mut Command) -> Result<String, String> {
    let result = command
        .output()
        .map_err(|error| format!("{command:?}: {error}"))?;
    if !result.status.success() {
        return Err(format!(
            "{command:?} failed: {}",
            String::from_utf8_lossy(&result.stderr)
        ));
    }
    String::from_utf8(result.stdout).map_err(|error| error.to_string())
}

fn local_exports(nm: &str) -> Result<Vec<&'static str>, String> {
    let mut locals = Vec::new();
    for &symbol in EXPORTS {
        let kinds: Vec<_> = nm
            .lines()
            .filter_map(|line| {
                let fields: Vec<_> = line.split_whitespace().collect();
                match fields.as_slice() {
                    [_, kind, name] if *name == symbol && *kind != "U" => Some(*kind),
                    _ => None,
                }
            })
            .collect();
        match kinds.as_slice() {
            ["T"] => (),
            ["t"] => locals.push(symbol),
            _ => {
                return Err(format!(
                    "Expected exactly one text definition of {symbol} in libafmize.a, found {kinds:?}"
                ));
            }
        }
    }
    Ok(locals)
}

pub fn ensure_exports(archive: &Path) -> Result<(), String> {
    let symbols = output(Command::new("xcrun").arg("nm").arg(archive))?;
    let locals = local_exports(&symbols)?;
    if locals.is_empty() {
        return Ok(());
    }
    let rustc = std::env::var_os("RUSTC").unwrap_or_else(|| "rustc".into());
    let sysroot = output(Command::new(rustc).args(["--print", "sysroot"]))?;
    let host = std::env::var("HOST")
        .unwrap_or_else(|_| format!("{}-apple-darwin", std::env::consts::ARCH));
    let objcopy = Path::new(sysroot.trim())
        .join("lib/rustlib")
        .join(host)
        .join("bin/llvm-objcopy");
    if !objcopy.is_file() {
        return Err("Swift C exports are local; install `rustup component add llvm-tools` for the active toolchain".into());
    }
    let mut command = Command::new(objcopy);
    for symbol in locals {
        command.arg(format!("--globalize-symbol={symbol}"));
    }
    output(command.arg(archive))?;
    let remaining = local_exports(&output(Command::new("xcrun").arg("nm").arg(archive))?)?;
    if !remaining.is_empty() {
        return Err(format!(
            "Swift exports still local after llvm-objcopy: {remaining:?}"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn symbols(kind: &str) -> String {
        EXPORTS
            .iter()
            .map(|name| format!("00000000 {kind} {name}\n"))
            .collect()
    }

    #[test]
    fn repairs_only_known_exports_and_accepts_already_global() {
        let nm = format!(
            "SwiftRs.o:\n{}00000000 t ___swift_helper\n                 U _release_object\n",
            symbols("t")
        );
        assert_eq!(local_exports(&nm).unwrap(), EXPORTS);
        assert!(local_exports(&symbols("T")).unwrap().is_empty());
    }

    #[test]
    fn rejects_missing_and_duplicate_definitions() {
        assert!(local_exports("").is_err());
        assert!(local_exports(&(symbols("t") + "00000000 t _retain_object\n")).is_err());
    }

    // Run explicitly on the Apple CI runner, where llvm-tools is installed.
    // This proves that archive indexes and the actual linker see the repair,
    // rather than only checking parsed nm text.
    #[test]
    #[cfg(target_os = "macos")]
    #[ignore = "requires Apple command line tools and rustup llvm-tools"]
    fn repairs_real_macho_archive_and_links_consumer() {
        let root = std::env::temp_dir().join(format!("afmize-link-test-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let source = root.join("bridge.c");
        let object = root.join("bridge.o");
        let archive = root.join("libafmize.a");
        let consumer = root.join("consumer.c");
        let binary = root.join("consumer");
        let mut definitions =
            String::from("__attribute__((used)) static void unrelated_helper(void) {}\n");
        let mut declarations = String::new();
        let mut calls = String::new();
        for symbol in EXPORTS {
            let name = &symbol[1..];
            definitions.push_str(&format!(
                "__attribute__((used)) static void {name}(void) {{}}\n"
            ));
            declarations.push_str(&format!("extern void {name}(void);\n"));
            calls.push_str(&format!("{name}();\n"));
        }
        std::fs::write(&source, definitions).unwrap();
        std::fs::write(
            &consumer,
            format!("{declarations}\nint main(void) {{ {calls} return 0; }}"),
        )
        .unwrap();
        output(
            Command::new("xcrun")
                .args(["clang", "-c"])
                .arg(&source)
                .arg("-o")
                .arg(&object),
        )
        .unwrap();
        output(
            Command::new("xcrun")
                .args(["libtool", "-static", "-o"])
                .arg(&archive)
                .arg(&object),
        )
        .unwrap();
        let link = || {
            let mut command = Command::new("xcrun");
            command
                .arg("clang")
                .arg(&consumer)
                .arg(&archive)
                .arg("-o")
                .arg(&binary);
            output(&mut command)
        };
        assert!(
            link().is_err(),
            "local symbols must not satisfy the consumer"
        );
        ensure_exports(&archive).unwrap();
        ensure_exports(&archive).unwrap(); // Idempotent for cached archives.
        link().unwrap();
        output(&mut Command::new(&binary)).unwrap();
        let nm = output(Command::new("xcrun").arg("nm").arg(&archive)).unwrap();
        assert!(nm.contains(" t _unrelated_helper"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn selects_platform_and_configuration_and_deduplicates_symlinks() {
        let root = std::env::temp_dir().join(format!("afmize-archive-test-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        for name in [
            "Release-iphoneos",
            "Release-iphonesimulator",
            "Debug-iphoneos",
        ] {
            let dir = root.join("out/Products").join(name);
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(dir.join("libafmize.a"), []).unwrap();
        }
        let expected = root
            .join("out/Products/Release-iphoneos/libafmize.a")
            .canonicalize()
            .unwrap();
        assert_eq!(
            find_archive(&root, "release", "iphoneos").unwrap(),
            expected
        );
        #[cfg(unix)]
        std::os::unix::fs::symlink(expected.parent().unwrap(), root.join("release")).unwrap();
        assert_eq!(
            find_archive(&root, "release", "iphoneos").unwrap(),
            expected
        );
        let duplicate = root.join("Products/Release-iphoneos");
        std::fs::create_dir_all(&duplicate).unwrap();
        std::fs::write(duplicate.join("libafmize.a"), []).unwrap();
        assert!(find_archive(&root, "release", "iphoneos").is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
