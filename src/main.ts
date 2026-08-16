import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { recentSizes, formatSizeInput } from "./lib/history";
import { parseTargetMb } from "./lib/validation";
import type { CompressionResult, Progress, Settings, VideoInfo } from "./types";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
let video: VideoInfo | null = null;
let outputDirectory = "";
let settings: Settings = { recent_target_sizes: [] };
let targetText = "";
let busy = false;
let result: CompressionResult | null = null;
let notice = "";
let error = "";
let progress: Progress = { percent: 0, eta_seconds: null };

const formatBytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
const formatDuration = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};
const basename = (path: string) => path.replace(/.*[\\/]/, "");
const dirname = (path: string) => path.replace(/[\\/][^\\/]+$/, "");
const escape = (value: string) => value.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function qualityWarning() {
  if (!video) return "";
  const target = parseTargetMb(targetText);
  if (!target) return "";
  const recommended = Math.ceil((video.duration_seconds * 620_000) / 8 / 1_000_000);
  if (target * 1_000_000 / video.duration_seconds * 8 < 600_000) {
    return `このサイズまで小さくすると、映像がかなり粗くなる可能性があります。おすすめ：${recommended} MB以上`;
  }
  return "";
}

function render() {
  const recent = recentSizes(settings.recent_target_sizes);
  const target = parseTargetMb(targetText);
  const canCompress = Boolean(video && target && !busy);
  app.innerHTML = `
    <section class="shell">
      <header><div class="mark">M</div><div><h1>Mlab Movie Compressor</h1><p>MP4を指定したサイズ以下に、かんたん圧縮</p></div></header>
      ${error ? `<div class="message error" role="alert">${escape(error)}</div>` : ""}
      ${notice ? `<div class="message notice">${escape(notice)}</div>` : ""}
      ${!video ? `<button class="drop-zone" id="select-video" type="button"><span class="drop-icon">▱</span><strong>動画をここにドラッグ＆ドロップ</strong><small>または</small><span class="button-like">動画を選択</span><em>MP4ファイルのみ</em></button>` : `
        <section class="video-card"><div class="file-icon">▶</div><div class="file-meta"><strong>${escape(video.name)}</strong><span>${formatBytes(video.size_bytes)}　•　${formatDuration(video.duration_seconds)}${video.width ? `　•　${video.width} × ${video.height}` : ""}</span></div><button class="text-button" id="change-video" ${busy ? "disabled" : ""}>変更</button></section>
        <section class="form-section"><label for="target-size">目標サイズ</label><div class="target-row"><input id="target-size" inputmode="decimal" value="${escape(targetText)}" placeholder="例: 9.5" ${busy ? "disabled" : ""}/><span>MB</span></div><p id="target-error" class="field-error" ${targetText && !target ? "" : "hidden"}>0より大きい数値を入力してください。</p><p id="target-warning" class="warning" ${qualityWarning() ? "" : "hidden"}>${escape(qualityWarning())}</p></section>
        ${recent.length ? `<section class="recent"><span>最近使ったサイズ</span><div>${recent.map(value => `<button class="chip" data-size="${value}" ${busy ? "disabled" : ""}>${formatSizeInput(value)} MB</button>`).join("")}</div></section>` : ""}
        <section class="form-section output"><label>出力先</label><div class="output-row"><span title="${escape(outputDirectory || dirname(video.path))}">${escape(outputDirectory || dirname(video.path))}</span><button class="text-button" id="choose-output" ${busy ? "disabled" : ""}>変更</button></div></section>
        ${busy ? `<section class="progress-area"><div class="progress-title"><strong>圧縮しています…</strong><span>${Math.round(progress.percent)}%</span></div><div class="progress"><i style="width:${Math.min(100, Math.max(0, progress.percent))}%"></i></div>${progress.eta_seconds ? `<p>残り約 ${formatDuration(progress.eta_seconds)}</p>` : ""}<button class="secondary wide" id="cancel">キャンセル</button></section>` : `<button class="primary wide" id="compress" ${canCompress ? "" : "disabled"}>圧縮する</button>`}
        ${result ? `<section class="result"><div class="result-icon">✓</div><div><h2>圧縮が完了しました</h2><p>${formatBytes(video.size_bytes)} → ${formatBytes(result.output_size_bytes)}（${Math.max(0, Math.round((1 - result.output_size_bytes / video.size_bytes) * 100))}% 削減）</p><div class="result-actions"><button class="secondary" id="open-file">ファイルを開く</button><button class="secondary" id="open-folder">フォルダーを開く</button><button class="text-button" id="new-video">別の動画を選択</button></div></div></section>` : ""}
      `}
      <footer>対応形式：MP4　·　FFmpegを使用します</footer>
    </section>`;
  wireEvents();
}

async function selectVideo() {
  const picked = await open({ multiple: false, directory: false, filters: [{ name: "MP4動画", extensions: ["mp4"] }] });
  if (!picked || Array.isArray(picked)) return;
  await loadVideo(picked);
}

async function loadVideo(path: string) {
  error = ""; notice = ""; result = null;
  try {
    video = await invoke<VideoInfo>("inspect_video", { path });
    outputDirectory = dirname(video.path);
  } catch (reason) { error = userError(reason); }
  render();
}

async function chooseOutput() {
  const picked = await open({ directory: true, multiple: false, title: "出力先フォルダーを選択" });
  if (typeof picked === "string") { outputDirectory = picked; render(); }
}

async function compress() {
  const target = parseTargetMb(targetText);
  if (!video || !target || busy) return;
  error = ""; notice = ""; result = null; busy = true; progress = { percent: 0, eta_seconds: null }; render();
  try {
    const completed = await invoke<CompressionResult>("compress_video", { request: { input_path: video.path, output_directory: outputDirectory, target_mb: target } });
    result = completed;
    settings = await invoke<Settings>("record_target_size", { targetMb: target });
  } catch (reason) { error = userError(reason); }
  finally { busy = false; render(); }
}

function userError(reason: unknown): string {
  const message = typeof reason === "string" ? reason : "圧縮中に予期しない問題が発生しました。";
  return message.replace(/^Error:\s*/, "");
}

function wireEvents() {
  document.querySelector("#select-video, #change-video")?.addEventListener("click", selectVideo);
  document.querySelector<HTMLInputElement>("#target-size")?.addEventListener("input", event => {
    targetText = (event.target as HTMLInputElement).value;
    updateTargetControls();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-size]").forEach(button => button.addEventListener("click", () => { targetText = button.dataset.size!; render(); }));
  document.querySelector("#choose-output")?.addEventListener("click", chooseOutput);
  document.querySelector("#compress")?.addEventListener("click", compress);
  document.querySelector("#cancel")?.addEventListener("click", async () => { notice = "キャンセルしています…"; render(); await invoke("cancel_compression"); });
  document.querySelector("#open-file")?.addEventListener("click", () => result && openPath(result.output_path));
  document.querySelector("#open-folder")?.addEventListener("click", () => result && openPath(dirname(result.output_path)));
  document.querySelector("#new-video")?.addEventListener("click", selectVideo);
}

/** Updates the controls affected by the size field without replacing the focused input element. */
function updateTargetControls() {
  const target = parseTargetMb(targetText);
  const inputError = document.querySelector<HTMLElement>("#target-error");
  if (inputError) inputError.hidden = !(targetText && !target);

  const warning = qualityWarning();
  const warningElement = document.querySelector<HTMLElement>("#target-warning");
  if (warningElement) {
    warningElement.hidden = !warning;
    warningElement.textContent = warning;
  }

  const compressButton = document.querySelector<HTMLButtonElement>("#compress");
  if (compressButton) compressButton.disabled = !(video && target && !busy);
}

getCurrentWindow().onDragDropEvent(event => {
  if (event.payload.type === "drop" && !busy) void loadVideo(event.payload.paths[0]);
});
listen<Progress>("compression-progress", event => { progress = event.payload; if (busy) render(); });
invoke<Settings>("load_settings").then(value => { settings = value; render(); }).catch(() => render());
