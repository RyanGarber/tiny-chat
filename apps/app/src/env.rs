//! The environment of the user's own shell, for the commands the app runs.
//!
//! Launched from a terminal, the app inherits the terminal's environment; but
//! launched from Finder or the Dock, or relaunched after an update, it gets
//! launchd's bare one — `PATH=/usr/bin:/bin:/usr/sbin:/sbin` — and anything
//! the user's shell profile puts on the path (nvm, pnpm, Homebrew, bun) is
//! "command not found". So it is read once from an interactive login shell,
//! as a terminal would start, and laid over every command spawned.

use std::collections::HashMap;
use tokio::sync::OnceCell;

static ENV: OnceCell<HashMap<String, String>> = OnceCell::const_new();

/// Empty when it cannot be read, so commands keep what the app inherited.
pub async fn shell_env() -> &'static HashMap<String, String> {
    ENV.get_or_init(load).await
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
async fn load() -> HashMap<String, String> {
    from_login_shell().await.unwrap_or_default()
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
async fn load() -> HashMap<String, String> {
    HashMap::new()
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
const MARKER: &str = "__TINY_CHAT_ENV__";

/// Variables that describe the shell that printed them rather than the user.
#[cfg(any(target_os = "macos", target_os = "linux"))]
const SKIP: &[&str] = &["PWD", "OLDPWD", "SHLVL", "_"];

#[cfg(any(target_os = "macos", target_os = "linux"))]
async fn from_login_shell() -> Option<HashMap<String, String>> {
    let shell = login_shell()?;
    // A profile can print anything, so the listing is fenced off.
    let script = format!("printf '{MARKER}'; command env -0; printf '{MARKER}'");
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        tokio::process::Command::new(&shell)
            .args(["-i", "-l", "-c", &script])
            .stdin(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true)
            .output(),
    )
    .await
    .ok()?
    .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let start = stdout.find(MARKER)? + MARKER.len();
    let end = start + stdout[start..].find(MARKER)?;
    let env: HashMap<String, String> = stdout[start..end]
        .split('\0')
        .filter_map(|entry| entry.split_once('='))
        .filter(|(key, _)| !key.is_empty() && !SKIP.contains(key))
        .map(|(key, value)| (key.to_string(), value.to_string()))
        .collect();
    env.contains_key("PATH").then_some(env)
}

/// `$SHELL` when the app was given one, else the user's entry in the password
/// database, which is where a terminal looks too.
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn login_shell() -> Option<String> {
    if let Some(shell) = std::env::var("SHELL").ok().filter(|s| !s.is_empty()) {
        return Some(shell);
    }
    unsafe {
        let entry = libc::getpwuid(libc::getuid());
        if entry.is_null() || (*entry).pw_shell.is_null() {
            return None;
        }
        std::ffi::CStr::from_ptr((*entry).pw_shell)
            .to_str()
            .ok()
            .map(str::to_string)
    }
}

#[cfg(all(test, any(target_os = "macos", target_os = "linux")))]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_shell_env() {
        let env = shell_env().await;
        assert!(env.get("PATH").is_some_and(|path| !path.is_empty()));
        assert!(!env.contains_key("PWD"));
    }
}
