@echo off
setlocal

set "VSDEV=%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"
if not exist "%VSDEV%" (
  echo Microsoft C++ Build Tools 2022 was not found.
  echo Install the Desktop development with C++ workload, then try again.
  exit /b 1
)

call "%VSDEV%" -arch=x64 -host_arch=x64 >nul
if errorlevel 1 exit /b %errorlevel%

call "%~dp0..\node_modules\.bin\tauri.cmd" %*
exit /b %errorlevel%
