//! Desktop primitives for Tiny Chat's `computer` tool.
//!
//! Every request is a JSON object `{ id, method, params }` and gets exactly one
//! JSON response `{ id, ok: true, result }` or `{ id, ok: false, error: { code,
//! message } }`. The methods are primitives over xa11y: reading windows and
//! accessibility trees, acting on elements, synthesising input, and capturing
//! the screen. Refs, formatting, waiting, and policy all live in TypeScript.
//!
//! xa11y is synchronous and its live elements are only meaningful to the
//! provider that read them, so one worker thread owns all of it and runs
//! requests in order.

mod ffi;
mod worker;

use std::collections::HashSet;
use std::sync::mpsc::{self, Sender};
use std::sync::{Mutex, OnceLock};
use std::thread;

use serde_json::{Value, json};

struct Job {
    request: String,
    done: Box<dyn FnOnce(String) + Send>,
}

static JOBS: OnceLock<Sender<Job>> = OnceLock::new();
static CANCELLED: Mutex<Option<HashSet<i64>>> = Mutex::new(None);

fn jobs() -> &'static Sender<Job> {
    JOBS.get_or_init(|| {
        let (sender, receiver) = mpsc::channel::<Job>();
        thread::Builder::new()
            .name("computer".into())
            .spawn(move || {
                let mut worker = worker::Worker::default();
                for job in receiver {
                    let response = respond(&mut worker, &job.request);
                    (job.done)(response);
                }
            })
            .expect("failed to start the computer worker");
        sender
    })
}

fn respond(worker: &mut worker::Worker, request: &str) -> String {
    let request: Value = match serde_json::from_str(request) {
        Ok(request) => request,
        Err(error) => return failure(Value::Null, "invalid", &error.to_string()),
    };
    let id = request.get("id").cloned().unwrap_or(Value::Null);
    if take_cancelled(&id) {
        return failure(id, "aborted", "The request was aborted");
    }
    let method = request.get("method").and_then(Value::as_str).unwrap_or("");
    let params = request.get("params").cloned().unwrap_or(json!({}));
    match worker.dispatch(method, &params) {
        Ok(result) => json!({ "id": id, "ok": true, "result": result }).to_string(),
        Err(error) => failure(id, &error.code, &error.message),
    }
}

fn failure(id: Value, code: &str, message: &str) -> String {
    json!({ "id": id, "ok": false, "error": { "code": code, "message": message } }).to_string()
}

fn take_cancelled(id: &Value) -> bool {
    let Some(id) = id.as_i64() else { return false };
    let mut cancelled = CANCELLED
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    cancelled.get_or_insert_with(HashSet::new).remove(&id)
}

/// Queues `request` on the worker; `done` receives its response, once, from
/// the worker thread.
pub fn call(request: String, done: impl FnOnce(String) + Send + 'static) {
    let done: Box<dyn FnOnce(String) + Send> = Box::new(done);
    if let Err(mpsc::SendError(job)) = jobs().send(Job { request, done }) {
        (job.done)(failure(
            Value::Null,
            "platform",
            "The computer worker has stopped",
        ));
    }
}

/// Skips the request with this `id` if it has not started yet. A request that
/// is already running finishes; the steps between requests are where the tool
/// stops.
pub fn cancel(id: i64) {
    let mut cancelled = CANCELLED
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    cancelled.get_or_insert_with(HashSet::new).insert(id);
}
