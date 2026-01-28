use std::fs;
use std::path::Path;

fn main() {
    ensure_default_icon();
    tauri_build::build()
}

fn ensure_default_icon() {
    let icon_path = Path::new("icons/icon.ico");
    if icon_path.exists() {
        return;
    }

    if let Some(parent) = icon_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // Minimal 1x1 ico (opaque red pixel), base64 encoded.
    let ico_base64 = "AAABAAEAAQEAAAEAIAAwAAAAFgAAACgAAAABAAAAAgAAAAEAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AAAAAA==";
    if let Ok(bytes) = base64::decode(ico_base64) {
        let _ = fs::write(icon_path, bytes);
    }
}
