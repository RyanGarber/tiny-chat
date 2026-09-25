#[cfg(feature = "afm")]
#[path = "build_support/swift_archive.rs"]
mod swift_archive;

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
    for variable in ["DEVELOPER_DIR", "SDKROOT", "TOOLCHAINS", "SWIFT_RS_CLANG"] {
        println!("cargo:rerun-if-env-changed={variable}");
    }

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
        panic!("afmize swift runtime directory missing ({platform}): {swift_lib}");
    }

    if for_ios {
        println!("cargo:rustc-link-search=native={swift_lib}");
        let frameworks =
            sdk_frameworks_dir(platform).expect("xcrun could not locate the target SDK frameworks");
        println!("cargo:warning=afmize SDK frameworks: {frameworks}");
        println!("cargo:rustc-link-search=framework={frameworks}");
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
    // SwiftPM folds dependency objects into libafmize.a. The upstream
    // workaround only exports afmize's own symbols, not SwiftRs's C bridge.
    let configuration = if std::env::var("DEBUG").as_deref() == Ok("true") {
        "debug"
    } else {
        "release"
    };
    let archive = swift_archive::find_archive(
        &PathBuf::from(out_dir).join("swift-rs/afmize"),
        configuration,
        platform,
    )
    .unwrap_or_else(|error| panic!("{error}"));
    swift_archive::ensure_exports(&archive).unwrap_or_else(|error| panic!("{error}"));
    if let Some(root) = sdk_root {
        unsafe { std::env::set_var("SDKROOT", root) };
    }
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
    assert!(
        swift.status.success(),
        "xcrun --find swiftc failed: {}",
        String::from_utf8_lossy(&swift.stderr)
    );
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
