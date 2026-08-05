use tauri::Manager;

mod afm;
mod mcp_http;
mod mcp_stdio;
mod tools;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows"))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    let builder = builder.invoke_handler(tauri::generate_handler![
        tools::is_dir,
        tools::make_dir,
        tools::read_file,
        tools::read_dir,
        tools::write_file,
        tools::shell_exec,
        mcp_http::mcp_start_http,
        mcp_http::mcp_send_http,
        mcp_http::mcp_stop_http,
        mcp_stdio::mcp_start_stdio,
        mcp_stdio::mcp_send_stdio,
        mcp_stdio::mcp_stop_stdio,
        afm::afm_enabled,
        afm::afm_availability,
        afm::afm_stream,
        afm::afm_cancel
    ]);

    let builder = builder.setup(|app| {
        app.manage(mcp_http::HttpSessions::default());
        app.manage(mcp_stdio::StdioSessions::default());
        Ok(())
    });

    builder.run(tauri::generate_context!()).unwrap();
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(String),
    #[error("Reqwest error: {0}")]
    Reqwest(String),
    #[error("Unknown error: {0}")]
    Other(String),
}

impl serde::Serialize for Error {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        Self::Io(err.to_string())
    }
}

impl From<reqwest::Error> for Error {
    fn from(err: reqwest::Error) -> Self {
        Self::Reqwest(err.to_string())
    }
}

impl From<&str> for Error {
    fn from(err: &str) -> Self {
        Self::Other(err.to_string())
    }
}

impl From<String> for Error {
    fn from(err: String) -> Self {
        Self::Other(err)
    }
}
