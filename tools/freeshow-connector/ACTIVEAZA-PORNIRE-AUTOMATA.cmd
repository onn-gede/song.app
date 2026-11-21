@echo off
setlocal
set "TARGET_PATH=%~dp0PORNESTE-CONNECTOR.cmd"
set "LINK_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SongApp-FreeShow-Connector.lnk"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$shell=New-Object -ComObject WScript.Shell; $shortcut=$shell.CreateShortcut($env:LINK_PATH); $shortcut.TargetPath=$env:TARGET_PATH; $shortcut.WorkingDirectory=[System.IO.Path]::GetDirectoryName($env:TARGET_PATH); $shortcut.WindowStyle=7; $shortcut.Description='SongApp - Conector FreeShow'; $shortcut.Save()"
if errorlevel 1 (
  echo Pornirea automata nu a putut fi activata.
) else (
  echo Gata. Conectorul va porni automat, minimizat, la autentificarea in Windows.
  echo Nu muta acest folder. Daca il muti, ruleaza din nou acest fisier.
)
pause
