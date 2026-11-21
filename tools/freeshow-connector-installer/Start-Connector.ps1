$ErrorActionPreference = "Stop"
$InstallDir = $PSScriptRoot
$PidFile = Join-Path $InstallDir "connector.pid"
$Connector = Join-Path $InstallDir "connector.mjs"

if (Test-Path $PidFile) {
    $ExistingPid = 0
    [void][int]::TryParse((Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1), [ref]$ExistingPid)
    if ($ExistingPid -and (Get-Process -Id $ExistingPid -ErrorAction SilentlyContinue)) { exit 0 }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

$Node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $Node) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show("Node.js LTS nu este instalat. Descarcă-l de la https://nodejs.org/en/download/", "SongApp FreeShow", "OK", "Error") | Out-Null
    exit 1
}

$OutLog = Join-Path $InstallDir "connector.log"
$ErrorLog = Join-Path $InstallDir "connector-error.log"
$Process = Start-Process -FilePath $Node.Source -ArgumentList @("`"$Connector`"") -WorkingDirectory $InstallDir -WindowStyle Hidden -RedirectStandardOutput $OutLog -RedirectStandardError $ErrorLog -PassThru
$Process.Id | Set-Content -Path $PidFile -Encoding ascii
Start-Sleep -Milliseconds 500
if ($Process.HasExited) {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    exit 1
}
