//! lib/computer for the webview: requests and responses are its JSON, passed
//! through as they are.

#[cfg(desktop)]
mod computer_real {
    use crate::Error;

    /// Queues a request on lib/computer's worker and waits for its response.
    #[tauri::command]
    pub async fn computer_call(request: String) -> Result<String, Error> {
        let (sender, receiver) = tokio::sync::oneshot::channel();
        ::computer::call(request, move |response| {
            let _ = sender.send(response);
        });
        receiver
            .await
            .map_err(|error| Error::Other(error.to_string()))
    }

    /// Skips a queued request by its id.
    #[tauri::command]
    pub fn computer_cancel(id: i64) {
        ::computer::cancel(id);
    }
}

#[cfg(mobile)]
mod computer_shims {
    use crate::Error;

    #[tauri::command]
    pub fn computer_call() -> Result<String, Error> {
        Err(Error::Other("Computer use is only on desktop".into()))
    }

    #[tauri::command]
    pub fn computer_cancel() {}
}

#[cfg(desktop)]
pub use computer_real::*;
#[cfg(mobile)]
pub use computer_shims::*;
