use crate::Error;
use base64::Engine;

fn expand_path(path: &str, accept_parent: bool) -> Result<std::path::PathBuf, Error> {
    let expanded =
        shellexpand::full(path).map_err(|e| Error::Other(format!("Path expansion failed: {e}")))?;
    let p = std::path::PathBuf::from(expanded.as_ref());
    let canonical = if accept_parent && let Some(parent) = p.parent() {
        let resolved_parent = parent.canonicalize().map_err(|e| {
            Error::Io(format!(
                "Cannot resolve parent dir '{}': {e}",
                parent.display()
            ))
        })?;
        resolved_parent.join(p.file_name().ok_or("Invalid filename")?)
    } else {
        p.canonicalize()
            .map_err(|e| Error::Io(format!("Cannot resolve path '{}': {e}", p.display())))?
    };
    Ok(canonical)
}

#[tauri::command]
pub fn is_dir(path: &str) -> Result<bool, Error> {
    let dir = expand_path(path, false)?;
    Ok(dir.is_dir())
}

#[tauri::command]
pub fn make_dir(path: &str) -> Result<(), Error> {
    let dir = expand_path(path, true)?;
    std::fs::create_dir_all(&dir)?;
    Ok(())
}

#[tauri::command]
pub fn read_dir(path: &str) -> Result<Vec<FileInfo>, Error> {
    let dir = expand_path(path, false)?;
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
    let path = expand_path(path, false)?;
    let bytes = std::fs::read(&path).map_err(|e| Error::Io(format!("Cannot read file: {e}")))?;
    let data = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(FileData {
        path: path.to_string_lossy().to_string(),
        data,
    })
}

#[tauri::command]
pub fn write_file(path: &str, content: &str) -> Result<(), Error> {
    let path = expand_path(path, true)?;

    let canonical = if let Some(parent) = path.parent() {
        let resolved_parent = parent.canonicalize().map_err(|e| {
            Error::Io(format!(
                "Cannot resolve parent dir '{}': {e}",
                parent.display()
            ))
        })?;
        resolved_parent.join(path.file_name().ok_or("Invalid filename")?)
    } else {
        path
    };

    std::fs::write(&canonical, content)?;
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

#[tauri::command]
pub fn shell_exec(command: &str) -> Result<ShellOutput, Error> {
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(command)
        .output()?;
    Ok(ShellOutput {
        code: output.status.code(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_expand_path() {
        let path = "~";
        let expanded = expand_path(path, false).unwrap();
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
