@echo off
setlocal
title Vessie Local Console - Read Only
cd /d "%~dp0"
echo.
echo ======================================================
echo   SUPER PHI.VESSEL LOCAL CONSOLE   ^|   READ ONLY
echo ======================================================
echo.
echo This starts a private 127.0.0.1 browser dashboard.
echo No installation, administration, firewall change, or model execution.
echo Close this window or press Ctrl+C to stop the local console.
echo.
if not exist "%~dp0node.exe" (
  echo BLOCKED: bundled Node runtime is missing.
  echo Re-extract the official portable ZIP and inspect START_HERE.txt.
  pause
  exit /b 2
)
"%~dp0node.exe" "%~dp0server.mjs"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" echo Console stopped or blocked with code %RESULT%.
echo Local server is stopped when the process closes.
pause
exit /b %RESULT%
