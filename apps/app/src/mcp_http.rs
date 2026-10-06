use reqwest::{
    Client, Method,
    header::{HeaderMap, HeaderName, HeaderValue},
};
use std::collections::HashMap;
use tauri::Emitter;

fn http_client() -> Client {
    Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap()
}

#[tauri::command]
pub async fn mcp_start_http(
    app: tauri::AppHandle,
    http_sessions: tauri::State<'_, HttpSessions>,
    id: String,
    url: String,
    _headers: HashMap<String, String>,
) -> Result<(), crate::Error> {
    // TODO - handle extraPath like node?
    let base_url: reqwest::Url = url.parse().map_err(|e| format!("invalid url: {e}"))?;

    let client = http_client();

    let (tx, mut rx) = tokio::sync::mpsc::channel::<SessionMessage>(64);
    http_sessions.lock().await.insert(id.clone(), tx);

    let app_clone = app.clone();
    let id_clone = id.clone();

    println!(
        "proxying http via tauri: {} at url: {}",
        id_clone,
        base_url.as_str()
    );

    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            match msg {
                SessionMessage::Request {
                    method,
                    extra_path,
                    req_headers,
                    body,
                } => {
                    let mut target = base_url.clone();
                    // Append extra path segments (e.g. /message, /sse)
                    if !extra_path.is_empty() {
                        let joined = format!(
                            "{}{}",
                            target.path().trim_end_matches('/'),
                            if extra_path.starts_with('/') {
                                extra_path.clone()
                            } else {
                                format!("/{extra_path}")
                            }
                        );
                        target.set_path(&joined);
                    }

                    let app2 = app_clone.clone();
                    let id2 = id_clone.clone();
                    let client2 = client.clone();

                    tokio::spawn(async move {
                        if let Err(e) = proxy_request(
                            &client2,
                            target,
                            method,
                            req_headers,
                            body,
                            &app2,
                            &id2,
                            5,
                        )
                        .await
                        {
                            app2.emit(&format!("mcp-error:{}", id2), e.to_string()).ok();
                        }
                    });
                }
                SessionMessage::Stop => break,
            }
        }
    });

    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn proxy_request(
    client: &Client,
    url: reqwest::Url,
    method: String,
    headers: HashMap<String, String>,
    body: Vec<u8>,
    app: &tauri::AppHandle,
    id: &str,
    redirects_left: u8,
) -> Result<(), crate::Error> {
    let http_method =
        Method::from_bytes(method.as_bytes()).map_err(|e| format!("invalid method: {e}"))?;

    let mut header_map = HeaderMap::new();
    for (k, v) in &headers {
        let name_lower = k.to_lowercase();
        if matches!(
            name_lower.as_str(),
            "host" | "content-length" | "transfer-encoding"
        ) {
            continue;
        }
        if let (Ok(name), Ok(val)) = (
            HeaderName::from_bytes(k.as_bytes()),
            HeaderValue::from_str(v),
        ) {
            header_map.insert(name, val);
        }
    }

    println!(
        "sending http request: {:?} {:?} {:?}",
        http_method, url, header_map
    );

    let req = client
        .request(http_method.clone(), url.clone())
        .headers(header_map.clone())
        .body(body.clone())
        .build()?;

    let resp = client.execute(req).await?;
    let status = resp.status().as_u16();

    if matches!(status, 301 | 302 | 307 | 308)
        && redirects_left > 0
        && let Some(location) = resp.headers().get("location")
    {
        let location_str = location
            .to_str()
            .map_err(|e| format!("bad location: {e}"))?;
        let next_url = url
            .join(location_str)
            .map_err(|e| format!("bad redirect url: {e}"))?;
        // 307/308 preserve method+body; 301/302 collapse to GET
        let (next_method, next_body) = if matches!(status, 307 | 308) {
            (method, body)
        } else {
            ("GET".to_string(), vec![])
        };
        return Box::pin(proxy_request(
            client,
            next_url,
            next_method,
            headers,
            next_body,
            app,
            id,
            redirects_left - 1,
        ))
        .await;
    }

    println!("returning http response: {:?} {:?}", id, status);

    app.emit(
        &format!("mcp-response:{}", id),
        ResponseMeta {
            status,
            headers: resp
                .headers()
                .iter()
                .filter_map(|(k, v)| v.to_str().ok().map(|v| (k.to_string(), v.to_string())))
                .collect(),
        },
    )
    .ok();

    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let bytes = chunk?;
        if !bytes.is_empty() {
            app.emit(
                &format!("mcp-data:{}", id),
                String::from_utf8_lossy(&bytes).to_string(),
            )
            .ok();
        }
    }

    app.emit(&format!("mcp-end:{}", id), ()).ok();
    Ok(())
}

#[tauri::command]
pub async fn mcp_send_http(
    http_sessions: tauri::State<'_, HttpSessions>,
    id: String,
    method: String,
    extra_path: String,
    headers: HashMap<String, String>,
    body: Vec<u8>,
) -> Result<(), crate::Error> {
    let sessions = http_sessions.lock().await;
    let tx = sessions.get(&id).ok_or("unknown http session id")?;
    println!(
        "queuing http request: {:?} {:?} {:?} {:?}",
        method, extra_path, headers, body
    );
    tx.send(SessionMessage::Request {
        method,
        extra_path,
        req_headers: headers,
        body,
    })
    .await
    .map_err(|_| "session channel closed")?;
    Ok(())
}

#[tauri::command]
pub async fn mcp_stop_http(
    http_sessions: tauri::State<'_, HttpSessions>,
    id: String,
) -> Result<(), crate::Error> {
    let mut sessions = http_sessions.lock().await;
    if let Some(tx) = sessions.remove(&id) {
        tx.send(SessionMessage::Stop).await.ok();
    }
    Ok(())
}

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum SessionMessage {
    Request {
        method: String,
        extra_path: String,
        req_headers: HashMap<String, String>,
        body: Vec<u8>,
    },
    Stop,
}

#[derive(serde::Serialize, Clone)]
pub struct ResponseMeta {
    pub status: u16,
    pub headers: HashMap<String, String>,
}

pub type HttpSessions =
    tokio::sync::Mutex<HashMap<String, tokio::sync::mpsc::Sender<SessionMessage>>>;
