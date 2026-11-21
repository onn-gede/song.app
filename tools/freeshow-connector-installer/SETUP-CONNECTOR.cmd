@echo off
setlocal
title SongApp - Instalare conector FreeShow
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Installer-FreeShow.ps1"
if errorlevel 1 pause
endlocal
