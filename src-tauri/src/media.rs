use serde::{Deserialize, Serialize};
use std::{path::Path, process::Stdio};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tokio::process::Command;

use crate::app::AppError;

#[cfg(windows)]
fn hide_console(command: &mut Command) { command.creation_flags(0x0800_0000); } // CREATE_NO_WINDOW
#[cfg(not(windows))]
fn hide_console(_command: &mut Command) {}

#[derive(Debug, Clone, Serialize)]
pub struct VideoInfo {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub duration_seconds: f64,
    pub width: u32,
    pub height: u32,
    pub has_audio: bool,
}

#[derive(Debug, Serialize)]
pub struct MediaToolsStatus { pub available: bool, pub message: Option<String> }

#[derive(Deserialize)]
struct ProbeResult { format: ProbeFormat, streams: Vec<ProbeStream> }
#[derive(Deserialize)]
struct ProbeFormat { duration: Option<String> }
#[derive(Deserialize)]
struct ProbeStream { codec_type: Option<String>, width: Option<u32>, height: Option<u32> }

/// Development builds deliberately use a local FFmpeg installation. Packaged release builds use Tauri sidecars.
pub fn uses_bundled_sidecars() -> bool { !cfg!(debug_assertions) }

fn local_tool_path(environment_variable: &str, default_name: &str) -> String {
    std::env::var(environment_variable).unwrap_or_else(|_| default_name.into())
}

fn unavailable_message(tool: &str) -> String {
    if uses_bundled_sidecars() {
        format!("同梱された{tool}を起動できません。アプリを再インストールしてください。")
    } else {
        format!("{tool}が見つかりません。開発環境ではFFmpegをインストールし、PATHまたは環境変数を設定してください。")
    }
}

async fn ffprobe_output(app: &AppHandle, arguments: Vec<String>) -> Result<(bool, Vec<u8>, Vec<u8>), AppError> {
    if uses_bundled_sidecars() {
        let output = app.shell().sidecar("ffprobe")
            .map_err(|_| AppError::user(unavailable_message("ffprobe")))?
            .args(arguments).output().await
            .map_err(|_| AppError::user(unavailable_message("ffprobe")))?;
        Ok((output.status.success(), output.stdout, output.stderr))
    } else {
        let name = if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" };
        let mut command = Command::new(local_tool_path("MLAB_FFPROBE_PATH", name));
        hide_console(&mut command);
        let output = command.args(arguments).stdout(Stdio::piped()).stderr(Stdio::piped()).output().await
            .map_err(|error| if error.kind() == std::io::ErrorKind::NotFound { AppError::user(unavailable_message("ffprobe")) } else { AppError::user("動画情報を取得できませんでした。") })?;
        Ok((output.status.success(), output.stdout, output.stderr))
    }
}

async fn tool_runs(app: &AppHandle, name: &str) -> bool {
    if uses_bundled_sidecars() {
        match app.shell().sidecar(name) {
            Ok(command) => command.arg("-version").status().await.is_ok_and(|status| status.success()),
            Err(_) => false,
        }
    } else {
        let environment_variable = if name == "ffmpeg" { "MLAB_FFMPEG_PATH" } else { "MLAB_FFPROBE_PATH" };
        let executable = if cfg!(windows) { format!("{name}.exe") } else { name.into() };
        let mut command = Command::new(local_tool_path(environment_variable, &executable));
        hide_console(&mut command);
        command.arg("-version").stdout(Stdio::null()).stderr(Stdio::null()).status().await.is_ok_and(|status| status.success())
    }
}

pub async fn tools_status(app: &AppHandle) -> MediaToolsStatus {
    if !tool_runs(app, "ffprobe").await { return MediaToolsStatus { available: false, message: Some(unavailable_message("ffprobe")) }; }
    if !tool_runs(app, "ffmpeg").await { return MediaToolsStatus { available: false, message: Some(unavailable_message("ffmpeg")) }; }
    MediaToolsStatus { available: true, message: None }
}

pub async fn inspect(app: &AppHandle, path: &Path) -> Result<VideoInfo, AppError> {
    if path.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("mp4")) != Some(true) {
        return Err(AppError::user("MP4ファイルのみ選択できます。"));
    }
    let metadata = std::fs::metadata(path).map_err(|_| AppError::user("動画ファイルを読み取れません。ファイルへのアクセスを確認してください。"))?;
    let (success, stdout, _) = ffprobe_output(app, vec!["-v".into(), "error".into(), "-show_format".into(), "-show_streams".into(), "-of".into(), "json".into(), path.to_string_lossy().into_owned()]).await?;
    if !success { return Err(AppError::user("動画情報を取得できませんでした。MP4ファイルが壊れていないか確認してください。")); }
    let probe: ProbeResult = serde_json::from_slice(&stdout).map_err(|_| AppError::user("動画情報を読み取れませんでした。"))?;
    let duration = probe.format.duration.and_then(|value| value.parse::<f64>().ok()).filter(|value| *value > 0.0)
        .ok_or_else(|| AppError::user("動画の長さを取得できませんでした。"))?;
    let video = probe.streams.iter().find(|stream| stream.codec_type.as_deref() == Some("video"))
        .ok_or_else(|| AppError::user("このファイルには動画が含まれていません。"))?;
    Ok(VideoInfo { path: path.to_string_lossy().into_owned(), name: path.file_name().unwrap_or_default().to_string_lossy().into_owned(), size_bytes: metadata.len(), duration_seconds: duration, width: video.width.unwrap_or(0), height: video.height.unwrap_or(0), has_audio: probe.streams.iter().any(|stream| stream.codec_type.as_deref() == Some("audio")) })
}
