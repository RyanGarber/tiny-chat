#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut _builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows"))]
    {
        _builder = _builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    _builder.run(tauri::generate_context!()).unwrap();
}
