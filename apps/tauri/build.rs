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
fn link_afmize(with_ios: bool) {
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

    let swift = std::process::Command::new("xcrun")
        .args(["--find", "swiftc"])
        .output()
        .expect("xcrun --find swiftc failed — is Xcode installed?");
    let swift_out = String::from_utf8(swift.stdout).unwrap();
    let swift_path = std::path::Path::new(swift_out.trim())
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("lib/swift/macosx")
        .to_string_lossy()
        .to_string();
    println!("cargo:rustc-link-arg=-rpath");
    println!("cargo:rustc-link-arg={}", swift_path);

    println!("cargo:rustc-link-arg=-rpath");
    println!("cargo:rustc-link-arg=/usr/lib/swift");

    let mut linker = SwiftLinker::new("27.0").with_package("afmize", afmize_path.to_str().unwrap());

    if with_ios {
        linker = linker.with_ios("27.0");
    }

    linker.link();
}
