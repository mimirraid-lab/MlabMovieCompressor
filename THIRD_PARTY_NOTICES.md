# Third-Party Notices

## FFmpeg / ffprobe (Windows x64 distribution only)

The Windows x64 distribution of MlabMovieCompressor includes `ffmpeg.exe` and `ffprobe.exe` from **BtbN FFmpeg Builds**. The bundled Windows x64 files were supplied from `ffmpeg-n8.1-latest-win64-gpl-8.1.zip` and identify themselves as `ffmpeg version n8.1.2-44-g7c533d0f86-20260815`.

### Build identification and corresponding source

- FFmpeg version/build identifier: `n8.1.2-44-g7c533d0f86-20260815`
- FFmpeg source revision identifier: `7c533d0f86` (the revision embedded in the FFmpeg version string)
- BtbN artifact: `ffmpeg-n8.1-latest-win64-gpl-8.1.zip` for Windows x64
- Build mode confirmed with `ffmpeg -version`: `--enable-gpl --enable-version3`; `--enable-nonfree` is not enabled
- BtbN GPL variant license file: `COPYING.GPLv3`
- FFmpeg source repository: <https://git.ffmpeg.org/ffmpeg.git>
- Revision lookup: <https://git.ffmpeg.org/gitweb/ffmpeg.git/commit/7c533d0f86>

- FFmpeg project: <https://ffmpeg.org/>
- FFmpeg source code: <https://ffmpeg.org/download.html>
- BtbN FFmpeg Builds: <https://github.com/BtbN/FFmpeg-Builds>
- License: GNU General Public License, version 3 or (at your option) any later version (GPL-3.0-or-later)
- GPL license text: <https://www.gnu.org/licenses/gpl-3.0.html>

FFmpeg is an independent project and is not part of MlabMovieCompressor. The included binaries are used as external sidecar executables. Their licensing terms apply separately from the MIT License covering MlabMovieCompressor's original source code.

For every v0.1.0 Release that distributes these binaries, attach the unmodified GPLv3 license text, this notice, and the corresponding source bundle as Release Assets. The source bundle must include the FFmpeg source revision above and the dependency source archives obtained with the matching BtbN FFmpeg-Builds `download.sh`; the BtbN Release page's `Source code (zip)` asset alone is not the corresponding dependency source bundle. Record the exact BtbN archive, BtbN FFmpeg-Builds commit, source-bundle filename, and SHA-256 values in the Release notes. The operational checklist is in [docs/release/v0.1.0-checklist.md](docs/release/v0.1.0-checklist.md). Do not distribute a build made with `--enable-nonfree`.
