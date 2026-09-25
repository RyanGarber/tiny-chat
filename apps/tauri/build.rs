fn main() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if matches!(target_os.as_str(), "macos" | "ios") {
        #[cfg(feature = "afm")]
        link_afmize(target_os == "ios");
        #[cfg(not(feature = "afm"))]
        println!("cargo:warning=building without apple foundation model support");
    }
    tauri_build::build()
}

#[cfg(feature = "afm")]
fn link_afmize(for_ios: bool) {
    use std::path::PathBuf;
    use swift_rs::SwiftLinker;

    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let afmize_path = PathBuf::from(&manifest_dir)
        .join("lib/afmize")
        .canonicalize()
        .expect("afmize Swift package not found at lib/afmize");

    let out_dir = std::env::var("OUT_DIR").unwrap();
    let profile = std::env::var("PROFILE").unwrap();
    println!(
        "cargo:rustc-link-search=native={}/swift-rs/afmize/{}",
        out_dir, profile
    );

    // swift-rs adds `-L` for the target's Swift runtime, not an rpath.
    // macOS: rustc links the app, and dyld will not search the toolchain
    // `lib/swift/macosx` directory unless that rpath is injected.
    // iOS: Xcode links a staticlib (`cargo:rustc-link-arg` does not apply to
    // it). The generated project already searches
    // `$(TOOLCHAIN_DIR)/usr/lib/swift/$(PLATFORM_NAME)` (`iphoneos` or
    // `iphonesimulator`), embeds the stdlib, and uses
    // `@executable_path/Frameworks`. Reusing the macOS rpath would point the
    // iOS cdylib at the wrong slice; the cargo link only needs `-L` for
    // `lib/swift/iphoneos` (or the simulator equivalent). FoundationModels is
    // not in that list — Xcode has to be given `-framework FoundationModels`
    // itself, because a framework search path is not stored in the staticlib.
    let platform = swift_platform_dir(for_ios);
    let swift_lib = toolchain_swift_lib(platform);
    if std::path::Path::new(&swift_lib).is_dir() {
        println!("cargo:warning=afmize swift runtime ({platform}): {swift_lib}");
    } else {
        println!("cargo:warning=afmize swift runtime directory missing ({platform}): {swift_lib}");
    }

    if for_ios {
        println!("cargo:rustc-link-search=native={swift_lib}");
        if let Some(frameworks) = sdk_frameworks_dir(platform) {
            println!("cargo:warning=afmize SDK frameworks: {frameworks}");
            println!("cargo:rustc-link-search=framework={frameworks}");
        }
    } else {
        println!("cargo:rustc-link-arg=-rpath");
        println!("cargo:rustc-link-arg={swift_lib}");
        println!("cargo:rustc-link-arg=-rpath");
        println!("cargo:rustc-link-arg=/usr/lib/swift");
    }

    let mut linker = SwiftLinker::new("27.0").with_package("afmize", afmize_path.to_str().unwrap());

    if for_ios {
        linker = linker.with_ios("27.0");
    }

    // Xcode exports SDKROOT as the target SDK. swift-rs selects the SDK itself;
    // leaving SDKROOT set makes SwiftPM mix that sysroot with the host triple.
    // SAFETY: this build script has not spawned threads that read the environment.
    let sdk_root = std::env::var_os("SDKROOT");
    unsafe { std::env::remove_var("SDKROOT") };
    linker.link();
    if for_ios {
        // afmize's static archive does not absorb its SwiftRs dependency.
        // The Rust crate calls `release_object`, `retain_object`, and
        // `string_from_bytes`, which live only in libSwiftRs.a. Xcode 27
        // also emits those @_cdecl symbols as local, so the cdylib link
        // cannot see them until they are globalized.
        link_swift_rs_runtime(&out_dir);
    }
    if let Some(root) = sdk_root {
        unsafe { std::env::set_var("SDKROOT", root) };
    }
}

#[cfg(feature = "afm")]
fn link_swift_rs_runtime(out_dir: &str) {
    use std::path::{Path, PathBuf};

    let root = PathBuf::from(out_dir).join("swift-rs/afmize");
    let Some(archive) = find_static_lib(&root, "libSwiftRs.a") else {
        println!(
            "cargo:warning=afmize: libSwiftRs.a not found under {}",
            root.display()
        );
        return;
    };
    println!("cargo:warning=afmize linking {}", archive.display());
    globalize_swift_rs_exports(&archive);
    println!(
        "cargo:rustc-link-search=native={}",
        archive.parent().unwrap_or(Path::new(".")).display()
    );
    println!("cargo:rustc-link-lib=static=SwiftRs");
}

#[cfg(feature = "afm")]
fn find_static_lib(dir: &std::path::Path, name: &str) -> Option<std::path::PathBuf> {
    let mut stack = vec![dir.to_path_buf()];
    let mut found = None;
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            if path.file_name().and_then(|file| file.to_str()) != Some(name) {
                continue;
            }
            let in_release = path
                .parent()
                .and_then(|parent| parent.file_name())
                .and_then(|file| file.to_str())
                .is_some_and(|file| file.eq_ignore_ascii_case("release"));
            if found.is_none() || in_release {
                found = Some(path);
            }
        }
    }
    found
}

/// Promote local `@_cdecl` symbols in `SwiftRs.o` so ld can resolve them from
/// the Rust crate. Only this archive is rewritten, so the copies SPM embeds in
/// `libafmize.a` stay local and do not collide.
#[cfg(feature = "afm")]
fn globalize_swift_rs_exports(archive: &std::path::Path) {
    let Ok(nm) = std::process::Command::new("nm").arg(archive).output() else {
        return;
    };
    let mut in_swift_rs = false;
    let mut symbols = Vec::new();
    for line in String::from_utf8_lossy(&nm.stdout).lines() {
        if line.ends_with(':') {
            let header = line.trim_end_matches(':').trim_end_matches(')');
            let member = header.rsplit(['/', '(']).next().unwrap_or(header);
            in_swift_rs = member == "SwiftRs.o" || member == "lib.swift.o";
            continue;
        }
        if !in_swift_rs {
            continue;
        }
        let mut parts = line.split_whitespace();
        let (Some(_addr), Some(kind), Some(name)) = (parts.next(), parts.next(), parts.next())
        else {
            continue;
        };
        if kind != "t" || parts.next().is_some() {
            continue;
        }
        let Some(bare) = name.strip_prefix('_') else {
            continue;
        };
        if bare.is_empty()
            || bare.starts_with('_')
            || !bare.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
        {
            continue;
        }
        if !symbols.iter().any(|existing: &String| existing == name) {
            symbols.push(name.to_string());
        }
    }
    if symbols.is_empty() {
        return;
    }
    let Some(objcopy) = rustup_llvm_objcopy() else {
        println!(
            "cargo:warning=afmize: llvm-objcopy not found; SwiftRs @_cdecl symbols stay local"
        );
        return;
    };
    println!(
        "cargo:warning=afmize globalizing SwiftRs exports: {}",
        symbols.join(", ")
    );
    let mut cmd = std::process::Command::new(objcopy);
    for symbol in &symbols {
        cmd.arg(format!("--globalize-symbol={symbol}"));
    }
    let status = cmd.arg(archive).status();
    if !status.is_ok_and(|status| status.success()) {
        println!(
            "cargo:warning=afmize: llvm-objcopy failed for {}",
            archive.display()
        );
    }
}

#[cfg(feature = "afm")]
fn rustup_llvm_objcopy() -> Option<std::path::PathBuf> {
    let sysroot = std::process::Command::new("rustc")
        .args(["--print", "sysroot"])
        .output()
        .ok()?;
    let sysroot = String::from_utf8(sysroot.stdout).ok()?;
    let host = format!("{}-apple-darwin", std::env::consts::ARCH);
    let path = std::path::Path::new(sysroot.trim())
        .join("lib/rustlib")
        .join(host)
        .join("bin/llvm-objcopy");
    path.exists().then_some(path)
}

#[cfg(feature = "afm")]
fn swift_platform_dir(for_ios: bool) -> &'static str {
    if !for_ios {
        return "macosx";
    }
    let target = std::env::var("TARGET").unwrap_or_default();
    let simulator =
        target.contains("ios-sim") || (target.starts_with("x86_64") && target.contains("ios"));
    if simulator {
        "iphonesimulator"
    } else {
        "iphoneos"
    }
}

#[cfg(feature = "afm")]
fn toolchain_swift_lib(platform: &str) -> String {
    let swift = std::process::Command::new("xcrun")
        .args(["--find", "swiftc"])
        .output()
        .expect("xcrun --find swiftc failed — is Xcode installed?");
    let swift_out = String::from_utf8(swift.stdout).unwrap();
    std::path::Path::new(swift_out.trim())
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("lib/swift")
        .join(platform)
        .to_string_lossy()
        .to_string()
}

/// Framework search path for the cargo link of the iOS cdylib. The app itself
/// is linked later by Xcode, which needs `-framework FoundationModels` on its
/// own link line — this path is not forwarded out of the staticlib.
#[cfg(feature = "afm")]
fn sdk_frameworks_dir(platform: &str) -> Option<String> {
    let sdk = match platform {
        "iphoneos" => "iphoneos",
        "iphonesimulator" => "iphonesimulator",
        _ => return None,
    };
    let output = std::process::Command::new("xcrun")
        .args(["--sdk", sdk, "--show-sdk-path"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let sdk_path = String::from_utf8(output.stdout).ok()?;
    Some(
        std::path::Path::new(sdk_path.trim())
            .join("System/Library/Frameworks")
            .to_string_lossy()
            .to_string(),
    )
}
