//! Simple file logging for the desktop app.

use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::json;

const DEBUG_LOG_PATH: &str = r"d:\vladexecute\proj\VoiceCoPilot\.cursor\debug.log";

/// Resolve the base directory (next to the executable).
pub fn base_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.to_path_buf()))
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Resolve the log directory under the projects folder.
pub fn log_dir() -> PathBuf {
    base_dir().join("projects").join("logs")
}

/// Resolve the desktop log file path.
pub fn desktop_log_path() -> PathBuf {
    log_dir().join("desktop.log")
}

/// Resolve the sidecar log file path.
pub fn sidecar_log_path() -> PathBuf {
    log_dir().join("api.log")
}

/// Append a line to the desktop log file.
pub fn append_log(message: &str) {
    let log_path = desktop_log_path();
    if let Some(parent) = log_path.parent() {
        let _ = create_dir_all(parent);
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0);

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = writeln!(file, "[{}] {}", timestamp, message);
    }
}

/// Append a debug log entry to the debug log file.
pub fn append_debug_log(hypothesis_id: &str, location: &str, message: &str, data: serde_json::Value) {
    let payload = json!({
        "sessionId": "debug-session",
        "runId": "run1",
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_millis())
            .unwrap_or(0),
    });

    let debug_path = PathBuf::from(DEBUG_LOG_PATH);
    if let Some(parent) = debug_path.parent() {
        let _ = create_dir_all(parent);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(debug_path) {
        let _ = writeln!(file, "{}", payload.to_string());
    }
}
