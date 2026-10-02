use crate::Error;
use base64::Engine;
use std::collections::HashMap;
use std::sync::{Arc, Mutex as StdMutex};
use tokio::sync::oneshot;

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

/// Breadth-first listing of everything under `path`. Directories named in
/// `prune` (lower-cased) or deeper than `max_depth` are listed but not entered.
/// Deciding what to show is left to the caller; this only saves it a round
/// trip per directory.
#[tauri::command]
pub async fn walk(
    path: String,
    max_depth: usize,
    max_entries: usize,
    prune: Vec<String>,
) -> Result<WalkResult, Error> {
    tokio::task::spawn_blocking(move || walk_tree(&path, max_depth, max_entries, &prune))
        .await
        .map_err(|e| Error::Other(format!("Walk failed: {e}")))?
}

fn walk_tree(
    path: &str,
    max_depth: usize,
    max_entries: usize,
    prune: &[String],
) -> Result<WalkResult, Error> {
    let root = resolve(path)?;
    let prune: std::collections::HashSet<&str> = prune.iter().map(String::as_str).collect();
    let mut pending = std::collections::VecDeque::from([(root.clone(), 0usize)]);
    let mut entries = Vec::new();
    let mut truncated = false;

    while let Some((directory, depth)) = pending.pop_front() {
        let listing = match std::fs::read_dir(&directory) {
            Ok(listing) => listing,
            // A missing root is a real error; an unreadable subdirectory is not.
            Err(e) if directory == root => return Err(e.into()),
            Err(_) => continue,
        };
        let mut listing: Vec<_> = listing
            .filter_map(Result::ok)
            .map(|e| {
                let is_dir = e.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
                (e.path(), is_dir)
            })
            .collect();
        listing.sort();

        for (path, is_dir) in listing {
            if entries.len() >= max_entries {
                truncated = true;
                break;
            }
            let pruned = is_dir
                && path
                    .file_name()
                    .map(|name| prune.contains(name.to_string_lossy().to_lowercase().as_str()))
                    .unwrap_or(false);
            if is_dir && !pruned {
                if depth + 1 > max_depth {
                    truncated = true;
                } else {
                    pending.push_back((path.clone(), depth + 1));
                }
            }
            entries.push(FileInfo {
                path: path.to_string_lossy().to_string(),
                is_dir,
            });
        }
        if truncated && entries.len() >= max_entries {
            break;
        }
    }

    Ok(WalkResult {
        root: root.to_string_lossy().to_string(),
        entries,
        truncated,
    })
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
pub struct WalkResult {
    root: String,
    entries: Vec<FileInfo>,
    truncated: bool,
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
    #[serde(rename = "type")]
    stream: &'static str,
    value: String,
}

/// Bytes of a command's output held from its start, and again from its end.
/// Everything between is counted and dropped, so a command like `find /`
/// cannot grow the app without bound, or the result handed to the webview.
const KEEP: usize = 256 * 1024;

#[derive(Default)]
struct Collected {
    head: String,
    tail: String,
    omitted: usize,
}

impl Collected {
    fn push(&mut self, mut chunk: &str) {
        if self.head.len() < KEEP {
            let split = floor_char_boundary(chunk, KEEP - self.head.len());
            self.head.push_str(&chunk[..split]);
            chunk = &chunk[split..];
        }
        self.tail.push_str(chunk);
        if self.tail.len() > KEEP * 2 {
            let cut = floor_char_boundary(&self.tail, self.tail.len() - KEEP);
            self.omitted += cut;
            self.tail.drain(..cut);
        }
    }

    fn text(&self) -> String {
        if self.omitted == 0 {
            format!("{}{}", self.head, self.tail)
        } else {
            format!(
                "{}\n[… {} characters omitted …]\n{}",
                self.head, self.omitted, self.tail
            )
        }
    }
}

fn floor_char_boundary(text: &str, index: usize) -> usize {
    let mut index = index.min(text.len());
    while !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

/// Forwards a pipe to the channel as it fills, and keeps the head and tail of
/// what it saw. Reads bytes rather than lines so a command that redraws a
/// single line (a progress bar) still reports itself while it runs; reads are
/// large so a flood of output reaches the webview as few messages.
async fn pump<R>(
    mut reader: R,
    stream: &'static str,
    channel: tauri::ipc::Channel<ShellOutputChunk>,
    collected: Arc<StdMutex<Collected>>,
) where
    R: tokio::io::AsyncRead + Unpin,
{
    use tokio::io::AsyncReadExt;

    let mut buffer = vec![0u8; 64 * 1024];
    loop {
        let read = match reader.read(&mut buffer).await {
            Ok(0) | Err(_) => break,
            Ok(read) => read,
        };
        let value = String::from_utf8_lossy(&buffer[..read]).to_string();
        collected.lock().unwrap().push(&value);
        channel.send(ShellOutputChunk { stream, value }).ok();
    }
}

/// Running commands by the id the webview gave them, to stop them by.
pub type ShellProcesses = Arc<StdMutex<HashMap<String, oneshot::Sender<()>>>>;

/// Ends the command and everything it started: it runs as the leader of its
/// own process group, so the whole group is signalled rather than only `sh`.
fn kill_group(child: &mut tokio::process::Child) {
    #[cfg(unix)]
    if let Some(pid) = child.id() {
        let pid = pid as libc::pid_t;
        unsafe {
            libc::killpg(pid, libc::SIGTERM);
        }
        // Whatever ignores the polite request does not get a second one.
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            unsafe {
                libc::killpg(pid, libc::SIGKILL);
            }
        });
    }
    child.start_kill().ok();
}

#[tauri::command]
pub async fn shell_exec(
    processes: tauri::State<'_, ShellProcesses>,
    id: String,
    command: String,
    on_output_channel: tauri::ipc::Channel<ShellOutputChunk>,
) -> Result<ShellOutput, Error> {
    let mut builder = tokio::process::Command::new("sh");
    builder
        .arg("-c")
        .arg(&command)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    #[cfg(unix)]
    builder.process_group(0);
    let mut child = builder.spawn()?;

    let stdout = child.stdout.take().ok_or("Cannot capture stdout")?;
    let stderr = child.stderr.take().ok_or("Cannot capture stderr")?;

    let collected_stdout = Arc::new(StdMutex::new(Collected::default()));
    let collected_stderr = Arc::new(StdMutex::new(Collected::default()));
    let pumps = [
        tokio::spawn(pump(
            stdout,
            "stdout",
            on_output_channel.clone(),
            collected_stdout.clone(),
        )),
        tokio::spawn(pump(
            stderr,
            "stderr",
            on_output_channel,
            collected_stderr.clone(),
        )),
    ];

    let (cancel, cancelled) = oneshot::channel();
    processes.lock().unwrap().insert(id.clone(), cancel);

    let code = tokio::select! {
        status = child.wait() => status.map(|status| status.code()),
        _ = cancelled => {
            kill_group(&mut child);
            Ok(Some(130))
        }
    };
    processes.lock().unwrap().remove(&id);
    let code = code?;

    // A process that escaped the group can hold a pipe open; what was read by
    // now is what there is.
    for pump in pumps {
        tokio::time::timeout(std::time::Duration::from_secs(1), pump)
            .await
            .ok();
    }

    let stdout = collected_stdout.lock().unwrap().text();
    let stderr = collected_stderr.lock().unwrap().text();
    Ok(ShellOutput {
        code,
        stdout,
        stderr,
    })
}

#[tauri::command]
pub fn shell_kill(processes: tauri::State<'_, ShellProcesses>, id: String) {
    if let Some(cancel) = processes.lock().unwrap().remove(&id) {
        cancel.send(()).ok();
    }
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
    fn test_walk_prunes_and_caps() {
        let result = walk_tree(".", 16, 100_000, &["target".to_string()]).unwrap();
        assert!(result.entries.iter().any(|e| e.path.ends_with("tools.rs")));
        assert!(!result.entries.iter().any(|e| e.path.contains("/target/")));

        let capped = walk_tree(".", 16, 3, &[]).unwrap();
        assert_eq!(capped.entries.len(), 3);
        assert!(capped.truncated);
    }

    #[test]
    fn test_read_dir() {
        let path = ".";
        let files = read_dir(path).unwrap();
        assert!(!files.is_empty());
    }
}
