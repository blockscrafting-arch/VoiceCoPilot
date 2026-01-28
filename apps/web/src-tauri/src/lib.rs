//! VoiceCoPilot Tauri application library.
//!
//! Provides audio capture functionality and IPC commands for the desktop app.

use std::net::TcpListener;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

mod audio;
mod logging;

/// Initialize and run the Tauri application.
///
/// Sets up the application with audio capture capabilities and
/// registers IPC commands for the frontend.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // region agent log
    logging::append_debug_log(
        "H4",
        "lib.rs:run",
        "run_enter",
        serde_json::json!({ "cwd": std::env::current_dir().ok() }),
    );
    // endregion
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|_app| {
            let app = _app.app_handle();
            // region agent log
            logging::append_debug_log(
                "H4",
                "lib.rs:setup",
                "setup_enter",
                serde_json::json!({ "app_name": app.package_info().name.clone() }),
            );
            // endregion
            logging::append_log("Desktop app starting");
            let show_item =
                tauri::menu::MenuItem::with_id(app, "show", "Показать", true, None::<&str>)?;
            let hide_item =
                tauri::menu::MenuItem::with_id(app, "hide", "Скрыть", true, None::<&str>)?;
            let quit_item =
                tauri::menu::MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let tray_menu = tauri::menu::Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .menu(&tray_menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(event, tauri::tray::TrayIconEvent::DoubleClick { .. }) {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            #[cfg(not(debug_assertions))]
            {
                let log_path = logging::sidecar_log_path();
                let ready_listener = TcpListener::bind("127.0.0.1:0").ok();
                let ready_port = ready_listener
                    .as_ref()
                    .and_then(|listener| listener.local_addr().ok())
                    .map(|addr| addr.port());
                // region agent log
                logging::append_debug_log(
                    "H5",
                    "lib.rs:setup",
                    "sidecar_ready_listener",
                    serde_json::json!({ "port": ready_port }),
                );
                // endregion
                // region agent log
                logging::append_debug_log(
                    "H1",
                    "lib.rs:setup",
                    "sidecar_spawn_attempt",
                    serde_json::json!({ "log_path": log_path }),
                );
                // endregion
                if let Some(parent) = log_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }

                if let Ok(command) = app.shell().sidecar("voicecopilot-api") {
                    let command = command
                        .current_dir(logging::base_dir())
                        .env("VOICECOPILOT_LOG_PATH", log_path.to_string_lossy().to_string());
                    let command = if let Some(port) = ready_port {
                        command.env("VOICECOPILOT_READY_PORT", port.to_string())
                    } else {
                        command
                    };
                    match command.spawn() {
                        Ok((mut rx, _child)) => {
                            logging::append_log("Sidecar started");
                            // region agent log
                            logging::append_debug_log(
                                "H1",
                                "lib.rs:setup",
                                "sidecar_spawn_ok",
                                serde_json::json!({}),
                            );
                            // endregion
                            if let Some(listener) = ready_listener {
                                let app_handle = app.clone();
                                std::thread::spawn(move || {
                                    if let Ok((_stream, _addr)) = listener.accept() {
                                        let _ = app_handle.emit("sidecar-ready", ());
                                        // region agent log
                                        logging::append_debug_log(
                                            "H5",
                                            "lib.rs:setup",
                                            "sidecar_ready_tcp",
                                            serde_json::json!({}),
                                        );
                                        // endregion
                                    }
                                });
                            }
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let mut stdout_logged = false;
                                let mut stderr_logged = false;
                                while let Some(event) = rx.recv().await {
                                    match &event {
                                        CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                                            let text = String::from_utf8_lossy(line);
                                            if !stdout_logged && matches!(event, CommandEvent::Stdout(_)) {
                                                stdout_logged = true;
                                                // region agent log
                                                logging::append_debug_log(
                                                    "H5",
                                                    "lib.rs:setup",
                                                    "sidecar_stdout_line",
                                                    serde_json::json!({ "line": text.chars().take(120).collect::<String>() }),
                                                );
                                                // endregion
                                            }
                                            if !stderr_logged && matches!(event, CommandEvent::Stderr(_)) {
                                                stderr_logged = true;
                                                // region agent log
                                                logging::append_debug_log(
                                                    "H5",
                                                    "lib.rs:setup",
                                                    "sidecar_stderr_line",
                                                    serde_json::json!({ "line": text.chars().take(120).collect::<String>() }),
                                                );
                                                // endregion
                                            }
                                            if text.contains("Uvicorn running on")
                                                || text.contains("Application startup complete")
                                            {
                                                let _ = app_handle.emit("sidecar-ready", ());
                                                // region agent log
                                                logging::append_debug_log(
                                                    "H5",
                                                    "lib.rs:setup",
                                                    "sidecar_ready_emitted",
                                                    serde_json::json!({ "message": text.to_string() }),
                                                );
                                                // endregion
                                                break;
                                            }
                                        }
                                        CommandEvent::Error(error) => {
                                            // region agent log
                                            logging::append_debug_log(
                                                "H5",
                                                "lib.rs:setup",
                                                "sidecar_command_error",
                                                serde_json::json!({ "error": error }),
                                            );
                                            // endregion
                                        }
                                        _ => {}
                                    }
                                }
                            });
                        }
                        Err(error) => logging::append_log(&format!(
                            "Sidecar failed to start: {}",
                            error
                        )),
                    }
                } else {
                    logging::append_log("Sidecar is not configured");
                    // region agent log
                    logging::append_debug_log(
                        "H1",
                        "lib.rs:setup",
                        "sidecar_not_configured",
                        serde_json::json!({}),
                    );
                    // endregion
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            audio::start_capture,
            audio::start_microphone_capture,
            audio::start_loopback_capture,
            audio::stop_capture,
            audio::get_audio_devices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
