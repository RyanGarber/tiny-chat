//! The C ABI the CLI opens with `bun:ffi`, shaped like afmize's: JSON in, one
//! JSON string back through a callback, freed by the caller.

use std::ffi::{CStr, CString, c_char, c_void};

type Callback = unsafe extern "C" fn(*mut c_void, *mut c_char);

/// The context pointer only travels back to the caller, which owns it.
struct Context(*mut c_void);

// SAFETY: the pointer is never dereferenced here, only handed back.
unsafe impl Send for Context {}

/// Queues `request_json` and calls `callback(context, response_json)` once,
/// from the worker thread. The response is the caller's to free with
/// [`computer_string_free`].
///
/// # Safety
///
/// `request_json` must be a valid NUL-terminated string, and `callback` must
/// be safe to call from another thread.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn computer_call(
    request_json: *const c_char,
    context: *mut c_void,
    callback: Callback,
) {
    let request = if request_json.is_null() {
        String::new()
    } else {
        unsafe { CStr::from_ptr(request_json) }
            .to_string_lossy()
            .into_owned()
    };
    let context = Context(context);
    crate::call(request, move |response| {
        let context = context;
        let response = CString::new(response).unwrap_or_default();
        unsafe { callback(context.0, response.into_raw()) };
    });
}

/// Skips a queued request by its `id`; see [`crate::cancel`].
#[unsafe(no_mangle)]
pub extern "C" fn computer_cancel(id: i64) {
    crate::cancel(id);
}

/// Frees a response string handed to a callback.
///
/// # Safety
///
/// `pointer` must come from a [`computer_call`] callback, and be freed once.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn computer_string_free(pointer: *mut c_char) {
    if !pointer.is_null() {
        drop(unsafe { CString::from_raw(pointer) });
    }
}
