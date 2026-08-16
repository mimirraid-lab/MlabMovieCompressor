use serde::{Deserialize, Serialize};
use std::{path::{Path, PathBuf}, process::Stdio, sync::Arc, time::Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::{io::{AsyncBufReadExt, BufReader}, process::{Child, Command}, sync::Mutex};

use crate::{encoding, media, settings};

#[derive(Debug, thiserror::Error)]
#[error("{message}")]
pub struct AppError { message: String }
impl AppError { pub fn user(message: impl Into<String>) -> Self { Self { message: message.into() } } }
impl serde::Serialize for AppError { fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error> where S: serde::Serializer { serializer.serialize_str(&self.message) } }

#[derive(Default)]
pub struct CompressionManager { child: Arc<Mutex<Option<Child>>> }

#[derive(Deserialize)]
pub struct CompressionRequest { input_path: String, output_directory: String, target_mb: f64 }
#[derive(Serialize)]
pub struct CompressionResult { output_path: String, output_size_bytes: u64 }
#[derive(Clone, Serialize)]
struct Progress { percent: f64, eta_seconds: Option<u64> }

fn ffmpeg_path() -> String { std::env::var("MLAB_FFMPEG_PATH").unwrap_or_else(|_| if cfg!(windows) { "ffmpeg.exe".into() } else { "ffmpeg".into() }) }
fn null_device() -> &'static str { if cfg!(windows) { "NUL" } else { "/dev/null" } }

#[tauri::command]
pub async fn inspect_video(path: String) -> Result<media::VideoInfo, AppError> { media::inspect(Path::new(&path)).await }

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<settings::Settings, String> { settings::load(&app) }

#[tauri::command]
pub fn record_target_size(app: AppHandle, target_mb: f64) -> Result<settings::Settings, String> {
    if !target_mb.is_finite() || target_mb <= 0.0 { return Err("目標サイズが正しくありません。".into()); }
    settings::record(&app, target_mb)
}

#[tauri::command]
pub async fn cancel_compression(manager: State<'_, CompressionManager>) -> Result<(), AppError> {
    if let Some(mut child) = manager.child.lock().await.take() { let _ = child.kill().await; }
    Ok(())
}

#[tauri::command]
pub async fn compress_video(app: AppHandle, manager: State<'_, CompressionManager>, request: CompressionRequest) -> Result<CompressionResult, AppError> {
    let input = PathBuf::from(&request.input_path);
    let info = media::inspect(&input).await?;
    let output_dir = if request.output_directory.is_empty() { input.parent().unwrap_or(Path::new(".")).to_path_buf() } else { PathBuf::from(request.output_directory) };
    let output = encoding::output_path(&input, &output_dir)?;
    let plan = encoding::calculate_bitrate(request.target_mb, info.duration_seconds, info.has_audio)?;
    let free = available_space_hint(&output_dir);
    if let Some(bytes) = free { if bytes < request.target_mb as u64 * 1_000_000 { return Err(AppError::user("出力先のディスク容量が不足している可能性があります。")); } }
    let pass_prefix = std::env::temp_dir().join(format!("mlab-pass-{}", std::process::id()));
    let result = run_two_passes(&app, &manager, &input, &output, &pass_prefix, &info, plan).await;
    encoding::remove_pass_logs(&pass_prefix);
    if result.is_err() { let _ = std::fs::remove_file(&output); }
    result?;
    let size = std::fs::metadata(&output).map_err(|_| AppError::user("圧縮後のファイルを確認できませんでした。"))?.len();
    Ok(CompressionResult { output_path: output.to_string_lossy().into_owned(), output_size_bytes: size })
}

async fn run_two_passes(app: &AppHandle, manager: &CompressionManager, input: &Path, output: &Path, prefix: &Path, info: &media::VideoInfo, plan: encoding::BitratePlan) -> Result<(), AppError> {
    let video_bitrate = format!("{}", plan.video_bps);
    let prefix_text = prefix.to_string_lossy().into_owned();
    let pass_one = vec!["-y".into(), "-i".into(), input.to_string_lossy().into_owned(), "-map".into(), "0:v:0".into(), "-c:v".into(), "libx264".into(), "-b:v".into(), video_bitrate.clone(), "-pass".into(), "1".into(), "-passlogfile".into(), prefix_text.clone(), "-an".into(), "-f".into(), "null".into(), null_device().into()];
    run_pass(app, manager, pass_one, info.duration_seconds, 0.0).await?;
    let mut pass_two = vec!["-y".into(), "-i".into(), input.to_string_lossy().into_owned(), "-map".into(), "0:v:0".into(), "-map".into(), "0:a?".into(), "-c:v".into(), "libx264".into(), "-b:v".into(), video_bitrate, "-pass".into(), "2".into(), "-passlogfile".into(), prefix_text, "-movflags".into(), "+faststart".into()];
    if info.has_audio { pass_two.extend(["-c:a".into(), "aac".into(), "-b:a".into(), format!("{}", plan.audio_bps)]); }
    pass_two.push(output.to_string_lossy().into_owned());
    run_pass(app, manager, pass_two, info.duration_seconds, 50.0).await
}

async fn run_pass(app: &AppHandle, manager: &CompressionManager, args: Vec<String>, duration: f64, base: f64) -> Result<(), AppError> {
    let mut child = Command::new(ffmpeg_path()).arg("-v").arg("error").arg("-progress").arg("pipe:1").arg("-nostats").args(args).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()
        .map_err(|error| if error.kind() == std::io::ErrorKind::NotFound { AppError::user("ffmpegが見つかりません。FFmpegをインストールし、PATHまたはMLAB_FFMPEG_PATHを設定してください。") } else { AppError::user("FFmpegを開始できませんでした。") })?;
    let stdout = child.stdout.take().ok_or_else(|| AppError::user("FFmpegの進捗を取得できませんでした。"))?;
    let stderr = child.stderr.take();
    *manager.child.lock().await = Some(child);
    let started = Instant::now(); let mut output = BufReader::new(stdout).lines(); let mut last_time = 0.0;
    while let Some(line) = output.next_line().await.map_err(|_| AppError::user("FFmpegの進捗取得に失敗しました。"))? {
        if let Some(value) = line.strip_prefix("out_time_us=").or_else(|| line.strip_prefix("out_time_ms=")).and_then(|value| value.parse::<f64>().ok()) { last_time = value / 1_000_000.0; }
        if line == "progress=continue" || line == "progress=end" {
            let fraction = (last_time / duration).clamp(0.0, 1.0);
            let percent = base + fraction * 50.0;
            let eta_seconds = if fraction > 0.02 { Some((((started.elapsed().as_secs_f64() / fraction) - started.elapsed().as_secs_f64()) * (if base == 0.0 { 2.0 } else { 1.0 })) as u64) } else { None };
            let _ = app.emit("compression-progress", Progress { percent, eta_seconds });
        }
    }
    let status = match manager.child.lock().await.take() { Some(mut running) => running.wait().await.map_err(|_| AppError::user("FFmpegの終了状態を確認できませんでした。"))?, None => return Err(AppError::user("圧縮をキャンセルしました。")) };
    if !status.success() {
        if let Some(mut stream) = stderr { use tokio::io::AsyncReadExt; let mut log = Vec::new(); let _ = stream.read_to_end(&mut log).await; let detail = String::from_utf8_lossy(&log); save_log(app, &detail); if detail.contains("No space left on device") || detail.contains("There is not enough space") { return Err(AppError::user("出力先のディスク容量が不足しています。")); } }
        return Err(AppError::user("圧縮に失敗しました。入力ファイルと出力先を確認してください。詳細はアプリのログを確認できます。"));
    }
    Ok(())
}

fn save_log(app: &AppHandle, contents: &str) { if let Ok(directory) = app.path().app_log_dir() { let _ = std::fs::create_dir_all(&directory); let _ = std::fs::write(directory.join("ffmpeg-last-error.log"), contents); } }
fn available_space_hint(_directory: &Path) -> Option<u64> { None }
