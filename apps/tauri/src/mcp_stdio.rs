use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::ChildStdin;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn mcp_start_stdio(
    app: tauri::AppHandle,
    stdio_sessions: tauri::State<'_, StdioSessions>,
    id: String,
    command: Vec<String>,
    env: HashMap<String, String>,
) -> Result<(), crate::Error> {
    let executable = command.get(0).unwrap();

    let mut client = tokio::process::Command::new(executable)
        .args(command.iter().skip(1))
        .envs(env)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()?;

    let stdin = client.stdin.take().unwrap();
    let stdout = client.stdout.take().unwrap();

    let app_clone = app.clone();
    let id_clone = id.clone();

    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            app_clone.emit(&format!("mcp-data:{}", id_clone), line).ok();
        }
    });

    stdio_sessions.lock().await.insert(id, stdin);

    Ok(())
}

#[tauri::command]
pub async fn mcp_send_stdio(
    stdio_sessions: tauri::State<'_, StdioSessions>,
    id: String,
    data: String,
) -> Result<(), crate::Error> {
    let mut stdio_sessions = stdio_sessions.lock().await;
    let client = stdio_sessions.get_mut(&id).ok_or("unknown server id")?;
    client.write_all(format!("{}\n", data).as_bytes()).await?;
    Ok(())
}

#[tauri::command]
pub async fn mcp_stop_stdio(stdio_sessions: tauri::State<'_, StdioSessions>, id: String) -> Result<(), crate::Error> {
    stdio_sessions.lock().await.remove(&id);
    Ok(())
}

pub type StdioSessions = Arc<Mutex<HashMap<String, ChildStdin>>>;
