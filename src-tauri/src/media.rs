use serde::{Deserialize, Serialize};
use std::{path::Path, process::Stdio};
use tokio::process::Command;

use crate::app::AppError;

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

#[derive(Deserialize)]
struct ProbeResult { format: ProbeFormat, streams: Vec<ProbeStream> }
#[derive(Deserialize)]
struct ProbeFormat { duration: Option<String> }
#[derive(Deserialize)]
struct ProbeStream { codec_type: Option<String>, width: Option<u32>, height: Option<u32> }

pub fn ffprobe_path() -> String {
    std::env::var("MLAB_FFPROBE_PATH").unwrap_or_else(|_| if cfg!(windows) { "ffprobe.exe".into() } else { "ffprobe".into() })
}

pub async fn inspect(path: &Path) -> Result<VideoInfo, AppError> {
    if path.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("mp4")) != Some(true) {
        return Err(AppError::user("MP4ファイルのみ選択できます。"));
    }
    let metadata = std::fs::metadata(path).map_err(|_| AppError::user("動画ファイルを読み取れません。ファイルへのアクセスを確認してください。"))?;
    let output = Command::new(ffprobe_path())
        .args(["-v", "error", "-show_format", "-show_streams", "-of", "json"])
        .arg(path).stdout(Stdio::piped()).stderr(Stdio::piped()).output().await
        .map_err(|error| if error.kind() == std::io::ErrorKind::NotFound { AppError::user("ffprobeが見つかりません。FFmpegをインストールし、PATHまたはMLAB_FFPROBE_PATHを設定してください。") } else { AppError::user("動画情報を取得できませんでした。") })?;
    if !output.status.success() { return Err(AppError::user("動画情報を取得できませんでした。MP4ファイルが壊れていないか確認してください。")); }
    let probe: ProbeResult = serde_json::from_slice(&output.stdout).map_err(|_| AppError::user("動画情報を読み取れませんでした。"))?;
    let duration = probe.format.duration.and_then(|value| value.parse::<f64>().ok()).filter(|value| *value > 0.0)
        .ok_or_else(|| AppError::user("動画の長さを取得できませんでした。"))?;
    let video = probe.streams.iter().find(|stream| stream.codec_type.as_deref() == Some("video"))
        .ok_or_else(|| AppError::user("このファイルには動画が含まれていません。"))?;
    Ok(VideoInfo { path: path.to_string_lossy().into_owned(), name: path.file_name().unwrap_or_default().to_string_lossy().into_owned(), size_bytes: metadata.len(), duration_seconds: duration, width: video.width.unwrap_or(0), height: video.height.unwrap_or(0), has_audio: probe.streams.iter().any(|stream| stream.codec_type.as_deref() == Some("audio")) })
}
