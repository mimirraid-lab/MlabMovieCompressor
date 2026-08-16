use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings { pub recent_target_sizes: Vec<f64> }

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|_| "設定の保存先を準備できませんでした。" )?;
    fs::create_dir_all(&directory).map_err(|_| "設定の保存先を準備できませんでした。")?;
    Ok(directory.join("settings.json"))
}

pub fn load(app: &AppHandle) -> Result<Settings, String> {
    let path = settings_path(app)?;
    match fs::read_to_string(path) {
        Ok(text) => Ok(serde_json::from_str(&text).unwrap_or_default()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Settings::default()),
        Err(_) => Err("設定を読み取れませんでした。".into()),
    }
}

pub fn record(app: &AppHandle, target: f64) -> Result<Settings, String> {
    let mut settings = load(app)?;
    settings.recent_target_sizes.push(target);
    if settings.recent_target_sizes.len() > 4 {
        let first = settings.recent_target_sizes.len() - 4;
        settings.recent_target_sizes.drain(0..first);
    }
    let content = serde_json::to_string_pretty(&settings).map_err(|_| "設定を保存できませんでした。")?;
    fs::write(settings_path(app)?, content).map_err(|_| "設定を保存できませんでした。")?;
    Ok(settings)
}
