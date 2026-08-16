use std::{fs, path::{Path, PathBuf}};

use crate::app::AppError;

pub const AUDIO_BITRATE: u64 = 96_000;
const CONTAINER_OVERHEAD: u64 = 12_000;
const SAFETY_FACTOR: f64 = 0.94;
const MIN_VIDEO_BITRATE: u64 = 10_000;

#[derive(Debug, Clone, Copy)]
pub struct BitratePlan { pub video_bps: u64, pub audio_bps: u64 }

pub fn calculate_bitrate(target_mb: f64, duration_seconds: f64, has_audio: bool) -> Result<BitratePlan, AppError> {
    if !target_mb.is_finite() || target_mb <= 0.0 || !duration_seconds.is_finite() || duration_seconds <= 0.0 {
        return Err(AppError::user("目標サイズまたは動画の長さが正しくありません。"));
    }
    let audio_bps = if has_audio { AUDIO_BITRATE } else { 0 };
    let total_bps = (target_mb * 1_000_000.0 * 8.0 * SAFETY_FACTOR / duration_seconds).floor() as u64;
    let video_bps = total_bps.saturating_sub(audio_bps + CONTAINER_OVERHEAD);
    if video_bps < MIN_VIDEO_BITRATE {
        return Err(AppError::user("目標サイズが小さすぎるため、圧縮設定を計算できません。目標サイズを大きくしてください。"));
    }
    Ok(BitratePlan { video_bps, audio_bps })
}

pub fn output_path(input: &Path, directory: &Path) -> Result<PathBuf, AppError> {
    if !directory.is_dir() { return Err(AppError::user("出力先フォルダーを確認できません。")); }
    let stem = input.file_stem().and_then(|value| value.to_str()).unwrap_or("video");
    let primary = directory.join(format!("{stem}_compressed.mp4"));
    if !primary.exists() { return Ok(primary); }
    for number in 2..10_000_u32 {
        let candidate = directory.join(format!("{stem}_compressed_{number}.mp4"));
        if !candidate.exists() { return Ok(candidate); }
    }
    Err(AppError::user("安全な出力ファイル名を作成できませんでした。"))
}

pub fn remove_pass_logs(prefix: &Path) {
    let Some(parent) = prefix.parent() else { return }; let Some(name) = prefix.file_name().and_then(|value| value.to_str()) else { return };
    if let Ok(entries) = fs::read_dir(parent) {
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().starts_with(name) { let _ = fs::remove_file(entry.path()); }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn budget_reserves_audio_overhead_and_margin() {
        let plan = calculate_bitrate(10.0, 60.0, true).unwrap();
        assert_eq!(plan.audio_bps, AUDIO_BITRATE);
        assert!(plan.video_bps > 1_000_000);
    }

    #[test]
    fn rejects_unworkably_small_budgets() { assert!(calculate_bitrate(0.001, 60.0, true).is_err()); }

    #[test]
    fn creates_a_non_overwriting_name() {
        let directory = tempdir().unwrap(); let input = directory.path().join("sample.mp4");
        fs::write(&input, "x").unwrap(); fs::write(directory.path().join("sample_compressed.mp4"), "x").unwrap();
        assert_eq!(output_path(&input, directory.path()).unwrap().file_name().unwrap(), "sample_compressed_2.mp4");
    }
}
