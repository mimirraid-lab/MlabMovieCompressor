export interface VideoInfo {
  path: string;
  name: string;
  size_bytes: number;
  duration_seconds: number;
  width: number;
  height: number;
  has_audio: boolean;
}

export interface Settings { recent_target_sizes: number[] }
export interface CompressionResult { output_path: string; output_size_bytes: number }
export interface Progress { percent: number; eta_seconds: number | null }
