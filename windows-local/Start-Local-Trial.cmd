@echo off
setlocal
title Vessie Local Console - Explicit One-Shot Trials
cd /d "%~dp0"
echo.
echo ============================================================
echo    SUPER PHI.VESSEL LOCAL CONSOLE - OPTIONAL LOCAL TRIAL
echo ============================================================
echo.
echo WARNING: This opt-in launches a local model generation endpoint.
echo It can use your PC's CPU/GPU and power. It is NOT read-only.
echo Each trial needs a selected local-size model and manual approval.
echo Ollama cloud references are not eligible. No paid API, remote
echo models, agents, memory, routing, training, or history approved.
echo.
echo Default read-only mode is Start-Local-Vessie.cmd instead.
echo Type the exact word ENABLE to allow on-demand local trials.
set "CONFIRM="
set /p "CONFIRM=Enter ENABLE to continue: "
if not "%CONFIRM%"=="ENABLE" (
  echo Local model trials remain disabled. No console started.
  pause
  exit /b 2
)
if not exist "%~dp0node.exe" (
  echo BLOCKED: bundled Node runtime missing. Re-extract official ZIP.
  pause
  exit /b 2
)
echo.
echo Starting local console on 127.0.0.1:8791 (manual trial enabled).
echo Only prompts you specifically approve inside the browser can run.
echo Close this window or press Ctrl+C to stop.
echo.
"%~dp0node.exe" "%~dp0server.mjs" --enable-local-trial
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" echo Console stopped or blocked with code %RESULT%.
pause
exit /b %RESULT%
