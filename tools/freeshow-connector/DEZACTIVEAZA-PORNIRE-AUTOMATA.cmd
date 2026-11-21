@echo off
set "LINK_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SongApp-FreeShow-Connector.lnk"
if exist "%LINK_PATH%" del /q "%LINK_PATH%"
echo Pornirea automata a conectorului a fost dezactivata.
pause
