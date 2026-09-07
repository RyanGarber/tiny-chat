use crate::Error;
use base64::Engine;

fn resolve(path: &str) -> Result<std::path::PathBuf, Error> {
    let expanded =
        shellexpand::full(path).map_err(|e| Error::Other(format!("Path expansion failed: {e}")))?;
    let p = std::path::PathBuf::from(expanded.as_ref());
    let canonical = p
        .canonicalize()
        .map_err(|e| Error::Io(format!("Cannot resolve path '{}': {e}", p.display())))?;
    Ok(canonical)
}
fn parent(path: &str) -> std::path::PathBuf {
    let p = std::path::PathBuf::from(path);
    p.parent()
        .map(std::path::PathBuf::from)
        .map(|p| {
            if p.components().count() > 0 {
                p
            } else {
                std::path::PathBuf::from(".")
            }
        })
        .unwrap_or_else(|| std::path::PathBuf::from("."))
}

#[tauri::command]
pub fn is_dir(path: &str) -> Result<bool, Error> {
    let dir = resolve(path)?;
    Ok(dir.is_dir())
}

#[tauri::command]
pub fn make_dir(path: &str) -> Result<(), Error> {
    std::fs::create_dir_all(path)?;
    Ok(())
}

#[tauri::command]
pub fn read_dir(path: &str) -> Result<Vec<FileInfo>, Error> {
    let dir = resolve(path)?;
    let entries = std::fs::read_dir(&dir)?;
    let outputs = entries
        .map(|e| {
            e.map(|e| FileInfo {
                path: e.path().to_string_lossy().to_string(),
                is_dir: e.file_type().map(|ft| ft.is_dir()).unwrap_or(false),
            })
            .map_err(Error::from)
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(outputs)
}

#[tauri::command]
pub fn read_file(path: &str) -> Result<FileData, Error> {
    let path = resolve(path)?;
    let bytes = std::fs::read(&path).map_err(|e| Error::Io(format!("Cannot read file: {e}")))?;
    let data = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(FileData {
        path: path.to_string_lossy().to_string(),
        data,
    })
}

#[tauri::command]
pub fn write_file(path: &str, content: &str) -> Result<(), Error> {
    let parent = parent(path);
    std::fs::create_dir_all(&parent).map_err(|e| {
        Error::Io(format!(
            "Cannot create parent dir '{}': {e}",
            parent.display()
        ))
    })?;

    let file = std::path::PathBuf::from(path);
    let file_name = file
        .file_name()
        .ok_or_else(|| Error::Other(format!("Invalid file path: {}", path)))?;

    let path = resolve(parent.to_str().unwrap())?.join(file_name);

    std::fs::write(&path, content)?;
    Ok(())
}

#[derive(serde::Serialize, Debug)]
pub struct FileInfo {
    path: String,
    is_dir: bool,
}

#[derive(serde::Serialize, Debug)]
pub struct FileData {
    path: String,
    data: String,
}

#[derive(serde::Serialize, Debug)]
pub struct ShellOutput {
    code: Option<i32>,
    stderr: String,
    stdout: String,
}

#[derive(serde::Serialize, Debug, Clone)]
pub struct ShellOutputChunk {
    stream: &'static str,
    value: String,
}

/// Forwards a pipe to the channel as it fills, and hands back everything it saw.
/// Reads bytes rather than lines so a command that redraws a single line (a
/// progress bar) still reports itself while it runs.
async fn pump<R>(
    mut reader: R,
    stream: &'static str,
    channel: tauri::ipc::Channel<ShellOutputChunk>,
) -> String
where
    R: tokio::io::AsyncRead + Unpin,
{
    use tokio::io::AsyncReadExt;

    let mut collected = String::new();
    let mut buffer = [0u8; 8192];
    loop {
        let read = match reader.read(&mut buffer).await {
            Ok(0) | Err(_) => break,
            Ok(read) => read,
        };
        let value = String::from_utf8_lossy(&buffer[..read]).to_string();
        collected.push_str(&value);
        channel.send(ShellOutputChunk { stream, value }).ok();
    }
    collected
}

#[tauri::command]
pub async fn shell_exec(
    command: String,
    on_output_channel: tauri::ipc::Channel<ShellOutputChunk>,
) -> Result<ShellOutput, Error> {
    let mut child = tokio::process::Command::new("sh")
        .arg("-c")
        .arg(&command)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()?;

    let stdout = child.stdout.take().ok_or("Cannot capture stdout")?;
    let stderr = child.stderr.take().ok_or("Cannot capture stderr")?;

    let stdout = tokio::spawn(pump(stdout, "stdout", on_output_channel.clone()));
    let stderr = tokio::spawn(pump(stderr, "stderr", on_output_channel));

    let status = child.wait().await?;

    Ok(ShellOutput {
        code: status.code(),
        stdout: stdout.await.unwrap_or_default(),
        stderr: stderr.await.unwrap_or_default(),
    })
}

#[tauri::command]
pub fn cwd() -> Result<String, Error> {
    let current_dir = std::env::current_dir()?;
    Ok(current_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn chdir(path: &str) -> Result<(), Error> {
    let path = resolve(path)?;
    std::env::set_current_dir(&path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_expand_path() {
        let path = "~";
        let expanded = resolve(path).unwrap();
        assert!(expanded.is_absolute());
    }

    #[test]
    fn test_is_dir() {
        let path = ".";
        let is_dir = is_dir(path).unwrap();
        assert!(is_dir);
    }

    #[test]
    fn test_read_dir() {
        let path = ".";
        let files = read_dir(path).unwrap();
        assert!(!files.is_empty());
    }
}
