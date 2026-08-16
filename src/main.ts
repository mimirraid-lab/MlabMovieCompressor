import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { recentSizes, formatSizeInput } from "./lib/history";
import { BYTES_PER_MIB, formatBytes, targetMbToBytes } from "./lib/fileSize";
import { parseTargetMb } from "./lib/validation";
import type { CompressionResult, MediaToolsStatus, Progress, Settings, VideoInfo } from "./types";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
let video: VideoInfo | null = null;
let outputDirectory = "";
let settings: Settings = { recent_target_sizes: [] };
let targetText = "";
let busy = false;
let analyzing = false;
let result: CompressionResult | null = null;
let notice = "";
let error = "";
let progress: Progress = { percent: 0, eta_seconds: null };

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
  const recommended = Math.ceil((video.duration_seconds * 620_000) / 8 / BYTES_PER_MIB);
  if (targetMbToBytes(target) / video.duration_seconds * 8 < 600_000) {
    return `このサイズまで小さくすると、映像がかなり粗くなる可能性があります。おすすめ：${recommended} MB以上`;
  }
  return "";
}

function render() {
  const recent = recentSizes(settings.recent_target_sizes);
  const target = parseTargetMb(targetText);
  const canCompress = Boolean(video && target && !busy && !analyzing);
  const locked = busy || analyzing;
  app.innerHTML = `
    <section class="shell">
      <header><div class="mark">M</div><div><h1>Mlab Movie Compressor</h1><p>MP4を指定したサイズ以下に、かんたん圧縮</p></div></header>
      ${error ? `<div class="message error" role="alert">${escape(error)}</div>` : ""}
      ${notice ? `<div class="message notice">${escape(notice)}</div>` : ""}
      ${analyzing ? `<section class="analysis-state"><span class="analysis-spinner" aria-hidden="true"></span><div><strong>動画を確認しています…</strong><p>動画の長さなどを確認しています。</p></div></section>` : ""}
      ${!video ? `<button class="drop-zone" id="select-video" type="button" ${locked ? "disabled" : ""}><span class="drop-icon">▱</span><strong>動画をここにドラッグ＆ドロップ</strong><small>または</small><span class="button-like">動画を選択</span><em>MP4ファイルのみ</em></button>` : `
        <section class="video-card"><div class="file-icon">▶</div><div class="file-meta"><strong>${escape(video.name)}</strong><span>${formatBytes(video.size_bytes)}　•　${formatDuration(video.duration_seconds)}${video.width ? `　•　${video.width} × ${video.height}` : ""}</span></div><button class="text-button" id="change-video" ${locked ? "disabled" : ""}>変更</button></section>
        <section class="form-section"><label for="target-size">目標サイズ</label><div class="target-row"><input id="target-size" inputmode="decimal" value="${escape(targetText)}" placeholder="例: 9.5" ${locked ? "disabled" : ""}/><span>MB</span></div><p id="target-error" class="field-error" ${targetText && !target ? "" : "hidden"}>0より大きい数値を入力してください。</p><p id="target-warning" class="warning" ${qualityWarning() ? "" : "hidden"}>${escape(qualityWarning())}</p></section>
        ${recent.length ? `<section class="recent"><span>最近使ったサイズ</span><div>${recent.map(value => `<button class="chip" data-size="${value}" ${locked ? "disabled" : ""}>${formatSizeInput(value)} MB</button>`).join("")}</div></section>` : ""}
        <section class="form-section output"><label>出力先</label><div class="output-row"><span title="${escape(outputDirectory || dirname(video.path))}">${escape(outputDirectory || dirname(video.path))}</span><button class="text-button" id="choose-output" ${locked ? "disabled" : ""}>変更</button></div></section>
        ${busy ? (!analyzing ? `<section class="progress-area"><div class="progress-title"><strong>圧縮しています…</strong><span>${Math.round(progress.percent)}%</span></div><div class="progress"><i style="width:${Math.min(100, Math.max(0, progress.percent))}%"></i></div>${progress.eta_seconds ? `<p>残り約 ${formatDuration(progress.eta_seconds)}</p>` : ""}<button class="secondary wide" id="cancel">キャンセル</button></section>` : "") : `<button class="primary wide" id="compress" ${canCompress ? "" : "disabled"}>圧縮する</button>`}
        ${result ? `<section class="result"><div class="result-icon">✓</div><div><h2>圧縮が完了しました</h2><p>${formatBytes(video.size_bytes)} → ${formatBytes(result.output_size_bytes)}（${Math.max(0, Math.round((1 - result.output_size_bytes / video.size_bytes) * 100))}% 削減）</p><div class="result-actions"><button class="secondary" id="open-file">ファイルを開く</button><button class="secondary" id="open-folder">フォルダーを開く</button><button class="text-button" id="new-video">別の動画を選択</button></div></div></section>` : ""}
      `}
      <footer>対応形式：MP4　·　FFmpegを使用します<br/><span class="size-note">※ ファイルサイズは 1 MB = 1 MiB（1,048,576 bytes）として計算します。</span></footer>
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
  analyzing = true; render();
  try {
    video = await invoke<VideoInfo>("inspect_video", { path });
    outputDirectory = dirname(video.path);
  } catch (reason) { error = userError(reason); }
  finally { analyzing = false; render(); }
}

async function chooseOutput() {
  const picked = await open({ directory: true, multiple: false, title: "出力先フォルダーを選択" });
  if (typeof picked === "string") { outputDirectory = picked; render(); }
}

async function compress() {
  const target = parseTargetMb(targetText);
  if (!video || !target || busy) return;
  error = ""; notice = ""; result = null; busy = true; analyzing = true; progress = { percent: 0, eta_seconds: null }; render();
  try {
    const completed = await invoke<CompressionResult>("compress_video", { request: { input_path: video.path, output_directory: outputDirectory, target_mb: target } });
    result = completed;
    settings = await invoke<Settings>("record_target_size", { targetMb: target });
  } catch (reason) { error = userError(reason); }
  finally { busy = false; analyzing = false; render(); }
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
listen<Progress>("compression-progress", event => { progress = event.payload; if (busy) { analyzing = false; render(); } });
listen("compression-started", () => { if (busy && analyzing) { analyzing = false; render(); } });
invoke<Settings>("load_settings").then(value => { settings = value; render(); }).catch(() => render());
invoke<MediaToolsStatus>("get_media_tools_status").then(status => {
  if (!status.available) error = status.message ?? "FFmpegを利用できません。";
  render();
}).catch(() => { error = "FFmpegの準備状況を確認できませんでした。"; render(); });
