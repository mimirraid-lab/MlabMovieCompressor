# Third-Party Notices

## FFmpeg / ffprobe (Windows x64 distribution only)

The Windows x64 distribution of MlabMovieCompressor includes `ffmpeg.exe` and `ffprobe.exe` from **BtbN FFmpeg Builds**. The currently bundled binaries identify themselves as `ffmpeg version n8.1.2-44-g7c533d0f86-20260815` and were built with `--enable-gpl`.

- FFmpeg project: <https://ffmpeg.org/>
- FFmpeg source code: <https://ffmpeg.org/download.html>
- BtbN FFmpeg Builds: <https://github.com/BtbN/FFmpeg-Builds>
- License: GNU General Public License, version 2 or (at your option) any later version (GPL-2.0-or-later)
- GPL license text: <https://www.gnu.org/licenses/old-licenses/gpl-2.0.html>

FFmpeg is an independent project and is not part of MlabMovieCompressor. The included binaries are used as external sidecar executables. Their licensing terms apply separately from the MIT License covering MlabMovieCompressor's original source code.

For the exact build configuration and corresponding source information, refer to the BtbN release used for the distributed binaries. Do not distribute a build made with `--enable-nonfree`.
