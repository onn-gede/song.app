Add-Type -AssemblyName System.Windows.Forms
$Answer = [System.Windows.Forms.MessageBox]::Show("Dorești să dezinstalezi conectorul SongApp pentru FreeShow?", "Dezinstalare", "YesNo", "Question")
if ($Answer -ne [System.Windows.Forms.DialogResult]::Yes) { exit 0 }

$InstallDir = $PSScriptRoot
& (Join-Path $InstallDir "Stop-Connector.ps1")

$Startup = [Environment]::GetFolderPath("Startup")
$Desktop = [Environment]::GetFolderPath("Desktop")
$Programs = [Environment]::GetFolderPath("Programs")
Remove-Item (Join-Path $Startup "SongApp FreeShow Connector.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $Desktop "SongApp FreeShow Connector.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $Programs "SongApp FreeShow") -Recurse -Force -ErrorAction SilentlyContinue

[System.Windows.Forms.MessageBox]::Show("Conectorul a fost dezinstalat.", "SongApp FreeShow", "OK", "Information") | Out-Null
$Escaped = $InstallDir.Replace('"','""')
Start-Process cmd.exe -WindowStyle Hidden -ArgumentList "/c timeout /t 2 /nobreak >nul & rmdir /s /q `"$Escaped`""
