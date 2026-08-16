mod app;
mod encoding;
mod media;
mod settings;

use app::{cancel_compression, compress_video, inspect_video, load_settings, record_target_size, CompressionManager};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(CompressionManager::default())
        .invoke_handler(tauri::generate_handler![
            inspect_video,
            compress_video,
            cancel_compression,
            load_settings,
            record_target_size
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mlab Movie Compressor");
}
