use crate::utils::should_include_file;
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
pub fn list_files(path: &str) -> Result<Vec<String>, Error> {
    let dir = expand_path(path, false)?;
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
    let path = expand_path(path, false)?;
    let bytes = std::fs::read(path).map_err(|e| Error::Io(format!("Cannot read file: {e}")))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
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

    std::fs::write(
        &canonical,
        base64::engine::general_purpose::STANDARD
            .decode(content)
            .expect("Invalid base64"),
    )?;
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

#[derive(serde::Serialize, Debug)]
pub struct SearchOutput {
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub fn search_files(
    path: &str,
    pattern: &str,
    max_matches: Option<usize>,
) -> Result<Vec<SearchOutput>, Error> {
    use regex::Regex;
    use std::io::{BufRead, BufReader};

    let root = expand_path(path, false)?;
    let re = Regex::new(pattern).map_err(|e| Error::Other(format!("Invalid regex: {e}")))?;
    let limit = max_matches.unwrap_or(25);

    let mut results: Vec<SearchOutput> = Vec::new();

    // Iterative directory walk using a stack to avoid deep recursion.
    let mut stack: Vec<std::path::PathBuf> = vec![root];

    'outer: while let Some(dir) = stack.pop() {
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue, // skip unreadable dirs silently
        };

        for entry in entries.flatten() {
            let entry_path = entry.path();
            let file_type = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };

            if file_type.is_dir() {
                stack.push(entry_path);
                continue;
            }

            if !file_type.is_file() {
                continue; // skip symlinks, pipes, etc.
            }

            if !should_include_file(&entry_path.to_string_lossy(), true) {
                continue; // skip excluded files
            }

            let file = match std::fs::File::open(&entry_path) {
                Ok(f) => f,
                Err(_) => continue, // skip unreadable files
            };

            let reader = BufReader::new(file);
            let path_str = entry_path.to_string_lossy().to_string();

            let lines = reader.lines();
            for (_idx, line_result) in lines.enumerate() {
                let line = match line_result {
                    Ok(l) => l,
                    Err(_) => break, // stop at first unreadable line (e.g. binary file)
                };

                if re.is_match(&line) {
                    let content = read_file(&path_str)?;
                    results.push(SearchOutput {
                        path: path_str.clone(),
                        content,
                    });

                    if results.len() >= limit {
                        break 'outer;
                    }
                }
            }
        }
    }

    Ok(results)
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
    fn test_list_files() {
        let path = ".";
        let files = list_files(path).unwrap();
        assert!(!files.is_empty());
    }

    #[test]
    fn test_search_files() {
        let path = ".";
        let pattern = "test";
        let matches = search_files(path, pattern, None).unwrap();
        println!("{:?}", matches);
        assert!(!matches.is_empty());
    }
}
