@echo off
setlocal
title Vessie Local Console - PhiServe Operator Model Desk
cd /d "%~dp0"
echo.
echo ==============================================================
echo   SUPER PHI.VESSEL MODEL DESK  ^|  OPTIONAL LOCAL INFERENCE
echo ==============================================================
echo.
echo This separately opts in to a private same-device PhiServe service.
echo The console binds only 127.0.0.1 and uses a private local token FILE.
echo It will NOT copy a token into the browser or enable model tools.
echo Each prompt requires its own separate checkbox approval.
echo The default Start-Local-Vessie.cmd remains READ ONLY.
echo.
echo WARNING: This may use your CPU/GPU and electricity.
echo Do not send sensitive text to a model unless you intend to.
echo.
set "CONFIRM="
set /p "CONFIRM=Type ENABLE to allow local PhiServe drafts: "
if not "%CONFIRM%"=="ENABLE" (
  echo PhiServe execution remains disabled.
  pause
  exit /b 2
)
if not exist "%~dp0node.exe" (
  echo BLOCKED: bundled Node runtime missing. Re-extract the official ZIP.
  pause
  exit /b 2
)
echo.
echo Enter the path to the PRIVATE PhiServe bearer-token FILE.
echo Only the file path is passed to the Node process, never the token itself.
set "PHISERVE_TOKEN_FILE="
set /p "PHISERVE_TOKEN_FILE=Private token file path: "
if not defined PHISERVE_TOKEN_FILE (
  echo BLOCKED: token file path required.
  pause
  exit /b 2
)
if not exist "%PHISERVE_TOKEN_FILE%" (
  echo BLOCKED: token file does not exist.
  pause
  exit /b 2
)
echo.
echo Starting localhost console with PhiServe drafting explicitly enabled.
echo Use the Model Desk to discover, approve and run ONE prompt at a time.
echo Close this window or press Ctrl+C to stop.
echo.
"%~dp0node.exe" "%~dp0local-console\server.mjs" --enable-phiserve-desk
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" echo Console stopped or blocked. No external fallback enabled.
pause
exit /b %RESULT%
