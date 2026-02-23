fn main() {
    // tauri_typegen::BuildSystem::generate_at_build_time().expect("failed to generate types");
    tauri_build::build()
}
