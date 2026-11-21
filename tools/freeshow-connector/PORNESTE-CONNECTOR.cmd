@echo off
title SongApp - Conector FreeShow
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nu este instalat sau nu este disponibil in PATH.
  echo Instaleaza Node.js LTS, apoi porneste din nou acest fisier.
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)
node "%~dp0connector.mjs"
echo.
echo Conectorul s-a oprit.
pause
