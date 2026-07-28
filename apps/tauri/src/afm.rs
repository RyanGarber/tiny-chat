#[cfg(all(any(target_os = "macos", target_os = "ios"), feature = "afm"))]
mod afm_real {
    use std::ffi::{CStr, CString, c_char, c_void};
    use tauri::ipc::Channel;

    type EventCallback = unsafe extern "C" fn(*mut c_void, *const c_char);

    unsafe extern "C" {
        fn afmize_availability() -> *mut c_char;
        fn afmize_string_free(ptr: *mut c_char);
        fn afmize_stream_start(
            request_json: *const c_char,
            context: *mut c_void,
            callback: EventCallback,
        ) -> i64;
        fn afmize_stream_cancel(stream_id: i64);
    }

    unsafe extern "C" fn on_event(context: *mut c_void, event_json: *const c_char) {
        if event_json.is_null() {
            // Terminal sentinel: reclaim the channel and stop.
            drop(unsafe { Box::from_raw(context as *mut Channel<serde_json::Value>) });
            return;
        }
        let channel = unsafe { &*(context as *const Channel<serde_json::Value>) };
        let json = unsafe { CStr::from_ptr(event_json) }.to_string_lossy();
        if let Ok(value) = serde_json::from_str(&json) {
            let _ = channel.send(value);
        }
    }

    #[tauri::command]
    pub fn afm_enabled() -> bool {
        true
    }

    #[tauri::command]
    pub fn afm_availability() -> String {
        unsafe {
            let ptr = afmize_availability();
            let out = CStr::from_ptr(ptr).to_string_lossy().into_owned();
            afmize_string_free(ptr);
            out
        }
    }

    #[tauri::command]
    pub fn afm_stream(
        request: serde_json::Value,
        on_event_channel: Channel<serde_json::Value>,
    ) -> i64 {
        let request = CString::new(request.to_string()).unwrap();
        let context = Box::into_raw(Box::new(on_event_channel)) as *mut c_void;
        unsafe { afmize_stream_start(request.as_ptr(), context, on_event) }
    }

    #[tauri::command]
    pub fn afm_cancel(stream_id: i64) {
        unsafe { afmize_stream_cancel(stream_id) }
    }
}

#[cfg(not(all(any(target_os = "macos", target_os = "ios"), feature = "afm")))]
mod afm_shims {
    #[tauri::command]
    pub fn afm_enabled() -> bool {
        false
    }

    #[tauri::command]
    pub fn afm_availability() {}

    #[tauri::command]
    pub fn afm_stream() {}

    #[tauri::command]
    pub fn afm_cancel() {}
}

#[cfg(all(any(target_os = "macos", target_os = "ios"), feature = "afm"))]
pub use afm_real::*;
#[cfg(not(all(any(target_os = "macos", target_os = "ios"), feature = "afm")))]
pub use afm_shims::*;
