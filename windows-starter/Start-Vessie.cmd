@echo off
setlocal
title SuperPhiVessel Windows Starter - Read Only
cd /d "%~dp0"
echo.
echo SuperPhiVessel Windows Starter
echo This is a read-only local readiness check and a link to the hosted cockpit.
echo It does not install software, enable model execution or change security settings.
echo.
powershell.exe -NoProfile -File "%~dp0Start-Vessie.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" echo Starter returned a blocked or unavailable status: %RESULT%
echo Review START_HERE.txt for first-run help.
pause
exit /b %RESULT%
