const EXCLUDE_FILES: &[&str] = &["__MACOSX/", ".DS_Store", "Thumbs.db"];

const EXCLUDE_FILES_ADDITIONAL: &[&str] = &[
    // 1. Git & Version Control
    ".git/",
    ".gitignore",
    ".gitattributes",
    ".gitmodules",
    // 2. Package Managers & Lockfiles
    "node_modules/",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "bun.lockb",
    "Cargo.lock",
    "Gemfile.lock",
    "poetry.lock",
    "uv.lock",
    "composer.lock",
    "mix.lock",
    ".pnp.cjs",
    ".pnp.loader.mjs",
    ".yarn/",
    // 3. Build Outputs, Framework Dirs & Compiled Code
    "dist/",
    "build/",
    "out/",
    "target/",
    "bin/",
    "obj/",
    ".next/",
    ".nuxt/",
    ".svelte-kit/",
    ".output/",
    "__pycache__/",
    ".pytest_cache/",
    // 4. Compiled Binaries & Bytecode
    ".class",
    ".o",
    ".so",
    ".dll",
    ".exe",
    ".dylib",
    ".pyc",
    ".pyo",
    ".jar",
    ".war",
    ".a",
    ".lib",
    ".map", // Source maps (massive JSON)
    // 6. Media, Fonts & Binary Assets
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".webp",
    ".svg", // Optional to ignore, but usually too noisy for LLMs
    ".mp3",
    ".mp4",
    ".wav",
    ".mov",
    ".ttf",
    ".woff",
    ".woff2",
    ".eot",
    ".otf",
    ".icns",
    // 7. Archives & Documents
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".7z",
    ".pdf",
    ".docx",
    ".xlsx",
];

pub fn should_include_file(path: &str, exclude_additional: bool) -> bool {
    EXCLUDE_FILES.iter().all(|&exclude| !path.contains(exclude))
        && (!exclude_additional
            || EXCLUDE_FILES_ADDITIONAL
                .iter()
                .all(|&exclude| !path.contains(exclude)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_inclusions() {
        assert!(!should_include_file(".DS_Store", false));
        assert!(should_include_file("src/__pycache__/cache", false));
        assert!(!should_include_file(
            "/node_modules/package-lock.json",
            true
        ));
    }
}
