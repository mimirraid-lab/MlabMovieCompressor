# MlabMovieCompressor

MlabMovieCompressorは、MP4動画を指定したファイルサイズ以下へ圧縮することに絞った、Windows x64向けデスクトップアプリです。動画編集やエンコードの詳しい設定を必要とせず、「動画を選ぶ」「目標MBを入れる」「圧縮する」の3ステップで使えることを目指しています。

このリポジトリは開発初期版です。入力・出力ともにMP4のみを対象とし、圧縮方式は固定です。

## 対応環境

- Windows 10 / 11 x64（v0.1.0の配布・確認対象）
- Node.js 20以降、Rust stable、Tauri 2のビルド前提条件
- 開発時のみFFmpeg / ffprobe（別途インストール）

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

## ビルド

```powershell
npm.cmd run tauri build
```

Windowsでは同様に `npm.cmd run tauri:build:windows` も利用できます。

WindowsではTauriのWebView2、macOSではXcode Command Line Toolsなど、OSごとのTauriビルド前提条件が必要です。詳しくはTauri 2の公式セットアップ手順を確認してください。

## FFmpegの準備

Windows x64の配布版には、FFmpeg / ffprobeをTauri sidecarとして同梱します。エンドユーザーがFFmpegをインストールしたり、PATHを設定したりする必要はありません。

開発時は、ローカルにインストールしたFFmpeg / ffprobeを `PATH` から実行します。必要に応じて、開発環境に限り環境変数で実行ファイルを指定できます。

```powershell
$env:MLAB_FFMPEG_PATH = "C:\\tools\\ffmpeg\\bin\\ffmpeg.exe"
$env:MLAB_FFPROBE_PATH = "C:\\tools\\ffmpeg\\bin\\ffprobe.exe"
```

Windows x64向けsidecarは、次のターゲットトリプル付きファイル名で配置します。

```text
src-tauri/binaries/
  ffmpeg-x86_64-pc-windows-msvc.exe
  ffprobe-x86_64-pc-windows-msvc.exe
```

これらのバイナリはサイズが大きいためGit管理対象外です。配布ビルドを行う環境へ、承認済みのBtbN FFmpeg Builds由来ファイルを配置してください。現在の対象はWindows x64のみで、Windows ARM / macOS向けsidecarは含みません。

FFmpegはMlabMovieCompressorとは別のプロジェクトです。Windows配布版はBtbN FFmpeg BuildsのGPLビルドを利用します。詳細な第三者ライセンス表記・ソース参照先は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を確認してください。MlabMovieCompressor自作部分のMIT Licenseとは別のライセンスです。

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

## v0.1.0 Release前チェック

Windows x64配布版を公開する前に、[v0.1.0 Release Preflight Checklist](docs/release/v0.1.0-checklist.md) を確認してください。FFmpeg未導入環境での圧縮、CMDウィンドウ非表示、解析から完了までのUI、pass間を含むキャンセル、およびGPL関連のRelease Asset確認を含みます。

## 現在の制約

- MP4以外、複数ファイル、解像度変更、FPS変更、ハードウェアエンコードは対象外です。
- 固定ビットレートの2回エンコードでも、映像内容やMP4コンテナの都合で指定サイズを厳密に保証するものではありません。容量超過を避けるため安全マージンを取ります。
- 目標サイズが極端に小さい場合は警告しますが、計算不能なほど小さい値は拒否します。
- v0.1.0の配布対象はWindows x64のみです。macOS、Windows ARM向けsidecar、アプリ署名・公証は未対応です。

## ライセンス

自作部分は [MIT License](LICENSE) です。

## Issue

Issueはバグ報告に利用できます。再現手順、OS、アプリのバージョン、入力動画の長さ・目標サイズ、および必要に応じてアプリログを添えてください。FFmpegの生のエラーは通常画面には表示せず、アプリのログ保存先に `ffmpeg-last-error.log` として保存します。ログにはローカルのファイルパスなど個人情報になり得る内容が含まれる場合があるため、Issueへ共有する前に内容を確認し、必要に応じて伏せてください。
