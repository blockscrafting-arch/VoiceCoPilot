@echo off
setlocal enabledelayedexpansion

for /f "usebackq delims=" %%i in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSPATH=%%i"

if "%VSPATH%"=="" (
  echo VS Build Tools not found.
  exit /b 1
)

call "%VSPATH%\Common7\Tools\VsDevCmd.bat" -arch=amd64
if errorlevel 1 exit /b %errorlevel%

pnpm tauri dev
