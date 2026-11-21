@echo off
title SongApp - Conector FreeShow
cd /d "%~dp0"
echo Pornesc legatura locala SongApp - FreeShow...
echo.
npm run freeshow:bridge
echo.
echo Conectorul s-a oprit. Apasa orice tasta pentru a inchide fereastra.
pause >nul
