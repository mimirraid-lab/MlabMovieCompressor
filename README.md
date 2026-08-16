# MlabMovieCompressor

MlabMovieCompressorは、MP4動画を指定したファイルサイズ以下へ圧縮することに絞った、Windows / macOS向けデスクトップアプリです。動画編集やエンコードの詳しい設定を必要とせず、「動画を選ぶ」「目標MBを入れる」「圧縮する」の3ステップで使えることを目指しています。

このリポジトリは開発初期版です。入力・出力ともにMP4のみを対象とし、圧縮方式は固定です。

## 対応環境

- Windows 10 / 11（開発・確認対象）
- macOS（Tauri 2が対応する環境。実機での署名・動作確認はこれからです）
- Node.js 20以降、Rust stable、Tauri 2のビルド前提条件
- FFmpeg / ffprobe（別途インストール）

## できること

- MP4を1本ずつ選択し、目標サイズ（MB、小数可）を指定して圧縮
- 動画のファイル名、元サイズ、長さ、解像度の表示
- 動画時間に応じた容量計算、画質低下警告、固定H.264 / AACの2回エンコード
- 出力先の選択、衝突しない `*_compressed.mp4` 名の自動作成
- 実際に使った目標サイズ4回分を、アプリ終了後も保存（表示は新しい順・重複なし）
- 進捗・キャンセル・完了後にファイルまたはフォルダーを開く操作

## 動かし方（開発）

依存関係を入れます。

```powershell
npm.cmd install
npm.cmd run tauri dev
```

WindowsでGit for Windowsなどの別の `link.exe` が優先される環境では、次のコマンドを使うとMicrosoft C++ Build Toolsの環境を自動で設定して起動できます。

```powershell
npm.cmd run tauri:dev:windows
```

macOS / Linuxでは `npm install` と `npm run tauri dev` を使えます。

## ビルド

```powershell
npm.cmd run tauri build
```

Windowsでは同様に `npm.cmd run tauri:build:windows` も利用できます。

WindowsではTauriのWebView2、macOSではXcode Command Line Toolsなど、OSごとのTauriビルド前提条件が必要です。詳しくはTauri 2の公式セットアップ手順を確認してください。

## FFmpegの準備

FFmpegバイナリはこのリポジトリに含めていません。FFmpegとffprobeをインストールして、両方が `PATH` から実行できるようにしてください。

配布方法を後から差し替えられるよう、実行パスは環境変数でも指定できます。

```powershell
$env:MLAB_FFMPEG_PATH = "C:\\tools\\ffmpeg\\bin\\ffmpeg.exe"
$env:MLAB_FFPROBE_PATH = "C:\\tools\\ffmpeg\\bin\\ffprobe.exe"
```

macOSの例：

```bash
export MLAB_FFMPEG_PATH=/opt/homebrew/bin/ffmpeg
export MLAB_FFPROBE_PATH=/opt/homebrew/bin/ffprobe
```

FFmpegはMlabMovieCompressorとは別のプロジェクトです。FFmpegの利用・再配布・ライセンス条件は、FFmpeg側のライセンスと配布条件を確認してください。

## テスト

FFmpegを実行せず検証できるフロントエンドの入力値・履歴ロジックは次でテストできます。

```powershell
npm.cmd test
```

Rust側にも、ビットレート計算と出力ファイル名のユニットテストを置いています。Rust環境を準備した後は次で実行できます。

```powershell
cd src-tauri
cargo test
```

## 現在の制約

- MP4以外、複数ファイル、解像度変更、FPS変更、ハードウェアエンコードは対象外です。
- 固定ビットレートの2回エンコードでも、映像内容やMP4コンテナの都合で指定サイズを厳密に保証するものではありません。容量超過を避けるため安全マージンを取ります。
- 目標サイズが極端に小さい場合は警告しますが、計算不能なほど小さい値は拒否します。
- 実機FFmpegを用いたWindows / macOSでの統合検証、アプリ署名・公証は未完了です。

## ライセンス

自作部分は [MIT License](LICENSE) です。

## Issue

Issueはバグ報告に利用できます。再現手順、OS、アプリのバージョン、入力動画の長さ・目標サイズ、および必要に応じてアプリログを添えてください。FFmpegの生のエラーは通常画面には表示せず、アプリのログ保存先に `ffmpeg-last-error.log` として保存します。
