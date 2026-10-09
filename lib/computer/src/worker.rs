//! The methods, run on the worker thread that owns every xa11y object.

use std::collections::{HashMap, VecDeque};
use std::process::Command;
use std::thread;

use base64::Engine;
use serde_json::{Map, Value, json};
use xa11y::input::{ClickOptions, DragOptions, Key, MouseButton, Point, ScrollDelta};
use xa11y::{App, AppExt, Element, Error, InputSim, Rect, Screenshot, Toggled};

/// How many past screenshots keep their coordinate mapping, so a point read
/// off one of them can still be clicked.
const FRAMES: usize = 16;
const DEFAULT_MAX_EDGE: u32 = 1280;
const JPEG_QUALITY: u8 = 75;

pub struct Failure {
    pub code: String,
    pub message: String,
}

impl Failure {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

impl From<Error> for Failure {
    fn from(error: Error) -> Self {
        let code = match &error {
            Error::PermissionDenied { .. } => "permission",
            Error::AccessibilityNotEnabled { .. } => "accessibility_disabled",
            Error::ElementStale { .. } => "stale",
            Error::ActionNotSupported { .. } | Error::TextValueNotSupported => "unsupported",
            Error::Unsupported { .. } => "unsupported",
            Error::NoElementBounds => "no_bounds",
            Error::SelectorNotMatched { .. } => "not_found",
            Error::Timeout { .. } => "timeout",
            Error::InvalidActionData { .. }
            | Error::InvalidSelector { .. }
            | Error::InvalidConfig { .. } => "invalid",
            _ => "platform",
        };
        Self::new(code, error.to_string())
    }
}

type Result<T> = std::result::Result<T, Failure>;

struct Window {
    id: u32,
    key: String,
    app: String,
    element: Element,
}

struct Handle {
    window: u32,
    element: Element,
}

#[derive(Default)]
pub struct Worker {
    windows: Vec<Window>,
    /// Window ids by identity, so a window keeps its id across listings.
    window_ids: HashMap<String, u32>,
    next_window: u32,
    handles: HashMap<u32, Handle>,
    next_handle: u32,
    frames: VecDeque<(u32, Screenshot)>,
    next_frame: u32,
    input: Option<std::result::Result<InputSim, String>>,
}

impl Worker {
    pub fn dispatch(&mut self, method: &str, params: &Value) -> Result<Value> {
        match method {
            "status" => Ok(self.status()),
            "windows" => self.list_windows(),
            "tree" => self.tree(params),
            "act" => self.act(params),
            "input" => self.input(params),
            "capture" => self.capture(params),
            "window" => self.window(params),
            "launch" => launch(params),
            _ => Err(Failure::new("invalid", format!("Unknown method: {method}"))),
        }
    }

    fn status(&mut self) -> Value {
        let mut missing = Vec::new();
        let mut errors = Map::new();
        if let Err(error) = App::list() {
            if matches!(error, Error::PermissionDenied { .. }) {
                missing.push("accessibility");
            }
            errors.insert("accessibility".into(), error.to_string().into());
        }
        if let Err(error) = xa11y::screenshot_region(Rect {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
        }) {
            if matches!(error, Error::PermissionDenied { .. }) {
                missing.push("screen");
            }
            errors.insert("screen".into(), error.to_string().into());
        }
        let input = match self.input_sim() {
            Ok(_) => true,
            Err(error) => {
                errors.insert("input".into(), error.message.into());
                false
            }
        };
        json!({
            "os": std::env::consts::OS,
            "pid": std::process::id(),
            "input": input,
            "missing": missing,
            "errors": errors,
        })
    }

    fn input_sim(&mut self) -> Result<&InputSim> {
        let input = self
            .input
            .get_or_insert_with(|| xa11y::input_sim().map_err(|error| error.to_string()));
        input
            .as_ref()
            .map_err(|message| Failure::new("unsupported", message.clone()))
    }

    // ── Windows ─────────────────────────────────────────────────────────

    fn refresh_windows(&mut self) -> Result<()> {
        let mut windows = Vec::new();
        for app in App::list()? {
            // An app that will not list its windows has none to offer.
            let Ok(elements) = app.windows() else {
                continue;
            };
            for (index, element) in elements.into_iter().enumerate() {
                let identity = element.stable_id.clone().unwrap_or_else(|| {
                    format!("{}#{index}", element.name.clone().unwrap_or_default())
                });
                let key = format!("{}:{identity}", app.pid.unwrap_or(0));
                let id = *self.window_ids.entry(key.clone()).or_insert_with(|| {
                    self.next_window += 1;
                    self.next_window
                });
                windows.push(Window {
                    id,
                    key,
                    app: app.name.clone(),
                    element,
                });
            }
        }
        self.window_ids
            .retain(|key, _| windows.iter().any(|window| &window.key == key));
        self.windows = windows;
        Ok(())
    }

    fn list_windows(&mut self) -> Result<Value> {
        self.refresh_windows()?;
        Ok(self
            .windows
            .iter()
            .map(|window| {
                let element = &window.element;
                json!({
                    "id": window.id,
                    "pid": element.pid,
                    "app": window.app,
                    "title": element.name,
                    "bounds": element.bounds.map(rect),
                    "focused": element.states.active,
                    "minimized": element.states.minimized,
                })
            })
            .collect())
    }

    /// The window's element, from a fresh listing: a window read earlier may
    /// have moved, retitled, or closed since.
    fn window_element(&mut self, id: u32) -> Result<Element> {
        self.refresh_windows()?;
        self.windows
            .iter()
            .find(|window| window.id == id)
            .map(|window| window.element.clone())
            .ok_or_else(|| {
                Failure::new("not_found", format!("No window w{id}; list windows again"))
            })
    }

    fn handle(&self, id: u32) -> Result<&Element> {
        self.handles
            .get(&id)
            .map(|handle| &handle.element)
            .ok_or_else(|| Failure::new("stale", format!("No element {id}; read the window again")))
    }

    // ── Tree ────────────────────────────────────────────────────────────

    fn tree(&mut self, params: &Value) -> Result<Value> {
        let window = u32_param(params, "window")?;
        let max_depth = params.get("depth").and_then(Value::as_u64).unwrap_or(40) as usize;
        let max_nodes = params
            .get("maxNodes")
            .and_then(Value::as_u64)
            .unwrap_or(2000) as usize;

        let root = match params.get("root").and_then(Value::as_u64) {
            Some(root) => self.handle(root as u32)?.clone(),
            None => {
                let element = self.window_element(window)?;
                // A fresh read of the whole window replaces its handles.
                self.handles.retain(|_, handle| handle.window != window);
                element
            }
        };

        let mut nodes = Vec::new();
        let mut truncated = false;
        let mut queue = VecDeque::from([(root, None::<u32>, 0usize)]);
        while let Some((element, parent, depth)) = queue.pop_front() {
            if nodes.len() >= max_nodes {
                truncated = true;
                break;
            }
            self.next_handle += 1;
            let handle = self.next_handle;
            nodes.push(node(&element, handle, parent));
            if depth < max_depth {
                // A subtree that fails to list is left out rather than failing
                // the whole read.
                if let Ok(children) = element.children() {
                    for child in children {
                        queue.push_back((child, Some(handle), depth + 1));
                    }
                }
            } else if !matches!(
                element.children().map(|children| children.is_empty()),
                Ok(true)
            ) {
                truncated = true;
            }
            self.handles.insert(handle, Handle { window, element });
        }

        Ok(json!({ "nodes": nodes, "truncated": truncated }))
    }

    // ── Actions ─────────────────────────────────────────────────────────

    fn act(&mut self, params: &Value) -> Result<Value> {
        let element = self.handle(u32_param(params, "handle")?)?;
        let action = str_param(params, "action")?;
        let value = params.get("value").and_then(Value::as_str);
        let require_value =
            || value.ok_or_else(|| Failure::new("invalid", format!("{action} needs a value")));
        match action {
            "press" => element.press()?,
            "focus" => element.focus()?,
            "blur" => element.blur()?,
            "toggle" => element.toggle()?,
            "select" => element.select()?,
            "expand" => element.expand()?,
            "collapse" => element.collapse()?,
            "show_menu" => element.show_menu()?,
            "increment" => element.increment()?,
            "decrement" => element.decrement()?,
            "scroll_into_view" => element.scroll_into_view()?,
            "set_value" => element.set_value(require_value()?)?,
            "type_text" => element.type_text(require_value()?)?,
            other => element.perform_action(other)?,
        }
        Ok(Value::Null)
    }

    // ── Input ───────────────────────────────────────────────────────────

    /// The screenshot named by `params.frame`, whose pixels points are in.
    fn frame(&self, params: &Value) -> Result<Option<Screenshot>> {
        let Some(id) = params.get("frame").and_then(Value::as_u64) else {
            return Ok(None);
        };
        self.frames
            .iter()
            .find(|(frame, _)| *frame == id as u32)
            .map(|(_, shot)| Some(shot.clone()))
            .ok_or_else(|| Failure::new("stale", "That screenshot is too old; take a new one"))
    }

    fn input(&mut self, params: &Value) -> Result<Value> {
        let frame = self.frame(params)?;
        let point = |event: &Value, x: &str, y: &str| -> Result<Point> {
            let point = Point::new(i32_param(event, x)?, i32_param(event, y)?);
            match &frame {
                Some(shot) => Ok(shot.image_to_desktop(point)?),
                None => Ok(point),
            }
        };

        let events = params
            .get("events")
            .and_then(Value::as_array)
            .ok_or_else(|| Failure::new("invalid", "input needs events"))?;
        let input = self.input_sim()?;
        let mouse = input.mouse();
        let keyboard = input.keyboard();
        for event in events {
            let held = keys(event.get("modifiers"))?;
            match str_param(event, "type")? {
                "move" => mouse.move_to(point(event, "x", "y")?)?,
                "click" => {
                    let count = event.get("count").and_then(Value::as_u64).unwrap_or(1) as u32;
                    let options = ClickOptions::new()
                        .button(button(event)?)
                        .count(count)
                        .held(held);
                    mouse.click_with(point(event, "x", "y")?.into(), options)?;
                }
                "drag" => {
                    let options = DragOptions::new().button(button(event)?).held(held);
                    mouse.drag_with(
                        point(event, "x", "y")?,
                        point(event, "toX", "toY")?,
                        options,
                    )?;
                }
                "scroll" => {
                    let delta = ScrollDelta::new(
                        event.get("dx").and_then(Value::as_i64).unwrap_or(0) as i32,
                        event.get("dy").and_then(Value::as_i64).unwrap_or(0) as i32,
                    );
                    mouse.scroll(point(event, "x", "y")?, delta)?;
                }
                "key" => keyboard.chord(key(str_param(event, "key")?)?, &held)?,
                "text" => keyboard.type_text(str_param(event, "text")?)?,
                other => return Err(Failure::new("invalid", format!("Unknown input: {other}"))),
            }
        }
        Ok(Value::Null)
    }

    // ── Capture ─────────────────────────────────────────────────────────

    fn capture(&mut self, params: &Value) -> Result<Value> {
        let region = if let Some(region) = params.get("region") {
            let (x, y) = (i32_param(region, "x")?, i32_param(region, "y")?);
            let (width, height) = (
                i32_param(region, "width")?.max(1),
                i32_param(region, "height")?.max(1),
            );
            // A region of an earlier screenshot is in its pixels; map both
            // corners back to the desktop.
            let (start, end) = match self.frame(params)? {
                Some(shot) => (
                    shot.image_to_desktop(Point::new(x, y))?,
                    shot.image_to_desktop(Point::new(x + width, y + height))?,
                ),
                None => (Point::new(x, y), Point::new(x + width, y + height)),
            };
            Some(Rect {
                x: start.x,
                y: start.y,
                width: (end.x - start.x).max(1) as u32,
                height: (end.y - start.y).max(1) as u32,
            })
        } else if let Some(handle) = params.get("handle").and_then(Value::as_u64) {
            Some(
                self.handle(handle as u32)?
                    .bounds
                    .ok_or(Error::NoElementBounds)?,
            )
        } else if let Some(window) = params.get("window").and_then(Value::as_u64) {
            Some(
                self.window_element(window as u32)?
                    .bounds
                    .ok_or(Error::NoElementBounds)?,
            )
        } else {
            None
        };
        let max_edge = params
            .get("maxEdge")
            .and_then(Value::as_u64)
            .map_or(DEFAULT_MAX_EDGE, |edge| edge as u32)
            .max(1);

        let mut shot = match region {
            Some(region) => xa11y::screenshot_region(region)?,
            None => xa11y::screenshot()?,
        };
        let edge = shot.width.max(shot.height);
        if edge > max_edge {
            let scale = max_edge as f64 / edge as f64;
            let width = ((shot.width as f64 * scale).round() as u32).max(1);
            let height = ((shot.height as f64 * scale).round() as u32).max(1);
            shot = shot.resize(width, height)?;
        }

        let mut jpeg = Vec::new();
        jpeg_encoder::Encoder::new(&mut jpeg, JPEG_QUALITY)
            .encode(
                &shot.pixels,
                shot.width as u16,
                shot.height as u16,
                jpeg_encoder::ColorType::Rgba,
            )
            .map_err(|error| Failure::new("platform", error.to_string()))?;

        self.next_frame += 1;
        let frame = self.next_frame;
        let (width, height) = (shot.width, shot.height);
        // Only the mapping is needed later, not the pixels.
        shot.pixels = Vec::new();
        self.frames.push_back((frame, shot));
        while self.frames.len() > FRAMES {
            self.frames.pop_front();
        }

        Ok(json!({
            "frame": frame,
            "mime": "image/jpeg",
            "data": base64::engine::general_purpose::STANDARD.encode(jpeg),
            "width": width,
            "height": height,
        }))
    }

    // ── Window management ───────────────────────────────────────────────

    fn window(&mut self, params: &Value) -> Result<Value> {
        let element = self.window_element(u32_param(params, "window")?)?;
        match str_param(params, "op")? {
            "activate" => element.activate()?,
            "minimize" => element.minimize()?,
            "maximize" => element.maximize()?,
            "restore" => element.restore()?,
            "close" => element.close()?,
            "move" => element.move_to(i32_param(params, "x")?, i32_param(params, "y")?)?,
            "resize" => {
                element.resize_to(u32_param(params, "width")?, u32_param(params, "height")?)?
            }
            other => {
                return Err(Failure::new(
                    "invalid",
                    format!("Unknown window op: {other}"),
                ));
            }
        }
        Ok(Value::Null)
    }
}

// ── Launching ───────────────────────────────────────────────────────────

/// Opens an app by name, or a file or app by path, with the platform's own
/// launcher, without waiting for it.
fn launch(params: &Value) -> Result<Value> {
    let target = str_param(params, "target")?;
    let args: Vec<String> = params
        .get("args")
        .and_then(Value::as_array)
        .map(|args| {
            args.iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect()
        })
        .unwrap_or_default();
    let is_path = std::path::Path::new(target).exists();

    let mut command = if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        if !is_path {
            command.arg("-a");
        }
        command.arg(target);
        if !args.is_empty() {
            command.arg("--args").args(&args);
        }
        command
    } else if cfg!(target_os = "windows") {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", ""]).arg(target).args(&args);
        command
    } else if is_path && !is_executable(target) {
        let mut command = Command::new("xdg-open");
        command.arg(target);
        command
    } else if !is_path && args.is_empty() && which("gtk-launch") && desktop_entry(target) {
        let mut command = Command::new("gtk-launch");
        command.arg(target);
        command
    } else {
        let mut command = Command::new(target);
        command.args(&args);
        command
    };

    let mut child = command
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|error| Failure::new("not_found", format!("Could not open {target}: {error}")))?;
    // Reap it whenever it exits, so it never lingers as a zombie.
    thread::spawn(move || child.wait());
    Ok(Value::Null)
}

#[cfg(unix)]
fn is_executable(path: &str) -> bool {
    use std::os::unix::fs::PermissionsExt;
    std::fs::metadata(path)
        .is_ok_and(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
}

#[cfg(not(unix))]
fn is_executable(_path: &str) -> bool {
    true
}

fn which(program: &str) -> bool {
    std::env::var_os("PATH")
        .is_some_and(|path| std::env::split_paths(&path).any(|dir| dir.join(program).is_file()))
}

/// Whether `name` is an installed `.desktop` entry, which `gtk-launch` opens.
fn desktop_entry(name: &str) -> bool {
    let file = format!("{}.desktop", name.trim_end_matches(".desktop"));
    let home =
        std::env::var_os("HOME").map(|home| std::path::PathBuf::from(home).join(".local/share"));
    let data =
        std::env::var("XDG_DATA_DIRS").unwrap_or_else(|_| "/usr/local/share:/usr/share".into());
    home.into_iter()
        .chain(std::env::split_paths(&data))
        .any(|dir| dir.join("applications").join(&file).is_file())
}

// ── Conversions ─────────────────────────────────────────────────────────

fn rect(rect: Rect) -> Value {
    json!({ "x": rect.x, "y": rect.y, "width": rect.width, "height": rect.height })
}

fn node(element: &Element, handle: u32, parent: Option<u32>) -> Value {
    let states = &element.states;
    let mut flags = Vec::new();
    let mut flag = |on: bool, name: &str| {
        if on {
            flags.push(Value::from(name));
        }
    };
    flag(!states.enabled, "disabled");
    flag(!states.visible, "hidden");
    flag(states.focused, "focused");
    flag(states.active, "active");
    flag(states.selected, "selected");
    flag(states.editable, "editable");
    flag(states.modal, "modal");
    flag(states.required, "required");
    flag(states.busy, "busy");
    flag(states.minimized == Some(true), "minimized");
    flag(states.expanded == Some(true), "expanded");
    flag(states.expanded == Some(false), "collapsed");
    flag(states.checked == Some(Toggled::On), "checked");
    flag(states.checked == Some(Toggled::Off), "unchecked");
    flag(states.checked == Some(Toggled::Mixed), "mixed");

    let mut node = Map::new();
    node.insert("handle".into(), handle.into());
    node.insert("parent".into(), parent.map_or(Value::Null, Value::from));
    node.insert("role".into(), element.role.to_snake_case().into());
    let mut text = |key: &str, value: &Option<String>| {
        if let Some(value) = value.as_ref().filter(|value| !value.is_empty()) {
            node.insert(key.into(), value.clone().into());
        }
    };
    text("name", &element.name);
    text("value", &element.value);
    text("description", &element.description);
    text("stableId", &element.stable_id);
    if let Some(bounds) = element.bounds {
        node.insert("bounds".into(), rect(bounds));
    }
    if !element.actions.is_empty() {
        node.insert("actions".into(), element.actions.clone().into());
    }
    if !flags.is_empty() {
        node.insert("states".into(), flags.into());
    }
    Value::Object(node)
}

fn button(event: &Value) -> Result<MouseButton> {
    match event
        .get("button")
        .and_then(Value::as_str)
        .unwrap_or("left")
    {
        "left" => Ok(MouseButton::Left),
        "right" => Ok(MouseButton::Right),
        "middle" => Ok(MouseButton::Middle),
        other => Err(Failure::new("invalid", format!("Unknown button: {other}"))),
    }
}

fn keys(value: Option<&Value>) -> Result<Vec<Key>> {
    value
        .and_then(Value::as_array)
        .map(|keys| {
            keys.iter()
                .map(|name| key(name.as_str().unwrap_or_default()))
                .collect::<Result<Vec<_>>>()
        })
        .unwrap_or_else(|| Ok(Vec::new()))
}

/// A key by its canonical name; TypeScript parses what the model writes.
fn key(name: &str) -> Result<Key> {
    let key = match name {
        "shift" => Key::Shift,
        "ctrl" => Key::Ctrl,
        "alt" => Key::Alt,
        "meta" => Key::Meta,
        "enter" => Key::Enter,
        "escape" => Key::Escape,
        "backspace" => Key::Backspace,
        "tab" => Key::Tab,
        "space" => Key::Space,
        "delete" => Key::Delete,
        "insert" => Key::Insert,
        "up" => Key::ArrowUp,
        "down" => Key::ArrowDown,
        "left" => Key::ArrowLeft,
        "right" => Key::ArrowRight,
        "home" => Key::Home,
        "end" => Key::End,
        "pageup" => Key::PageUp,
        "pagedown" => Key::PageDown,
        _ => {
            let mut chars = name.chars();
            match (chars.next(), chars.next()) {
                (Some(char), None) => Key::Char(char),
                _ => match name.strip_prefix('f').and_then(|n| n.parse::<u8>().ok()) {
                    Some(n @ 1..=24) => Key::F(n),
                    _ => return Err(Failure::new("invalid", format!("Unknown key: {name}"))),
                },
            }
        }
    };
    Ok(key)
}

fn str_param<'a>(params: &'a Value, name: &str) -> Result<&'a str> {
    params
        .get(name)
        .and_then(Value::as_str)
        .ok_or_else(|| Failure::new("invalid", format!("Missing {name}")))
}

fn i32_param(params: &Value, name: &str) -> Result<i32> {
    params
        .get(name)
        .and_then(Value::as_f64)
        .map(|value| value.round() as i32)
        .ok_or_else(|| Failure::new("invalid", format!("Missing {name}")))
}

fn u32_param(params: &Value, name: &str) -> Result<u32> {
    params
        .get(name)
        .and_then(Value::as_f64)
        .filter(|value| *value >= 0.0)
        .map(|value| value.round() as u32)
        .ok_or_else(|| Failure::new("invalid", format!("Missing {name}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_keys() {
        assert_eq!(key("enter").ok(), Some(Key::Enter));
        assert_eq!(key("a").ok(), Some(Key::Char('a')));
        assert_eq!(key("f12").ok(), Some(Key::F(12)));
        assert!(key("f99").is_err());
        assert!(key("hyper").is_err());
    }

    #[test]
    fn rejects_unknown_methods() {
        let mut worker = Worker::default();
        let error = worker
            .dispatch("nope", &json!({}))
            .err()
            .map(|failure| failure.code);
        assert_eq!(error.as_deref(), Some("invalid"));
    }

    #[test]
    fn requires_handles_to_be_read() {
        let mut worker = Worker::default();
        let error = worker
            .dispatch("act", &json!({ "handle": 7, "action": "press" }))
            .err()
            .map(|failure| failure.code);
        assert_eq!(error.as_deref(), Some("stale"));
    }
}
