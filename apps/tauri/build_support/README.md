# Apple Swift linking

The pinned `swift-rs` Cargo patch in `../Cargo.toml` is required for Xcode 27:
it uses SwiftPM's target triple for iOS, locates the new product layout, and
restores the package's own C exports after SwiftPM internalizes them.

SwiftPM includes SwiftRs dependency objects in `libafmize.a`. It does not
necessarily create `libSwiftRs.a`. The upstream repair deliberately skips
dependency exports, so `swift_archive.rs` restores only the known afmize and
SwiftRs C entry points in that existing archive. It verifies each definition
before and after rewriting; missing or duplicate definitions are build errors.
Do not promote arbitrary local symbols or add another copy of SwiftRs.

Cargo's patch and SwiftPM's dependency resolution are separate. The Swift
sources at the pinned Cargo revision are unchanged from SwiftRs 1.0.7; bumping
the Swift package alone does not fix this visibility problem.

The existing macOS rpaths are retained. iOS uses its own SDK/runtime search
paths, and the final Xcode link also needs `FoundationModels` (configured in
`scripts/build-ios-ci.sh` at the repository root).

Run the regression tests from the repository root on an Apple toolchain:

```sh
rustup component add llvm-tools
rustc --edition 2024 --test apps/tauri/build_support/swift_archive.rs -o /tmp/swift-archive-tests
/tmp/swift-archive-tests --include-ignored
```

The native test verifies failed linking before repair, successful linking and
execution afterward, idempotence, and preservation of unrelated local symbols.
It does not replace the macOS and iOS app builds in `ci-upgrade.yml`.
