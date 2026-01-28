@echo off
setlocal

set "APP_DIR=%~dp0"
set "EXE_PATH=%APP_DIR%apps\web\src-tauri\target\release\voicecopilot.exe"

if not exist "%EXE_PATH%" (
  echo [ERROR] voicecopilot.exe not found.
  echo Build it first with:
  echo   cd apps\web
  echo   pnpm tauri build
  exit /b 1
)

start "" "%EXE_PATH%"
