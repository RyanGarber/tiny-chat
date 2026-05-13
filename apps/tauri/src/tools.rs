use crate::Error;

fn expand_path(path: &str) -> Result<std::path::PathBuf, Error> {
    let expanded = shellexpand::full(path)
        .map_err(|e| Error::Other(format!("Path expansion failed: {e}")))?;
    let p = std::path::PathBuf::from(expanded.as_ref());
    let canonical = p.canonicalize()
        .map_err(|e| Error::Io(format!("Cannot resolve '{}': {e}", p.display())))?;
    Ok(canonical)
}

fn read_to_string_lossy(path: &str) -> Result<String, Error> {
    let bytes = std::fs::read(path).map_err(|e| Error::Io(format!("Cannot read file '{}': {e}", path)))?;
    let content = String::from_utf8_lossy(&bytes).to_string();
    Ok(content)
}

#[tauri::command]
pub fn is_dir(path: &str) -> Result<bool, Error> {
    let dir = expand_path(path)?;
    Ok(dir.is_dir())
}

#[tauri::command]
pub fn read_dir(path: &str) -> Result<Vec<String>, Error> {
    let dir = expand_path(path)?;
    let entries = std::fs::read_dir(&dir)?;
    let paths = entries
        .map(|e| {
            e.map(|e| e.path().to_string_lossy().to_string())
                .map_err(Error::from)
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(paths)
}

#[tauri::command]
pub fn read_file(path: &str) -> Result<String, Error> {
    let content = read_to_string_lossy(path)?;
    Ok(content)
}

#[tauri::command]
pub fn write_file(path: &str, contents: &str) -> Result<(), Error> {
    let expanded = shellexpand::full(path)
        .map_err(|e| Error::Other(format!("Path expansion failed: {e}")))?;
    let p = std::path::PathBuf::from(expanded.as_ref());

    let canonical = if let Some(parent) = p.parent() {
        let resolved_parent = parent.canonicalize()
            .map_err(|e| Error::Io(format!("Cannot resolve parent dir '{}': {e}", parent.display())))?;
        resolved_parent.join(p.file_name().ok_or("Invalid filename")?)
    } else {
        p
    };

    std::fs::write(&canonical, contents)?;
    Ok(())
}

#[derive(serde::Serialize, Debug)]
pub struct ShellOutput {
    status: Option<i32>,
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
        status: output.status.code(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
    })
}
