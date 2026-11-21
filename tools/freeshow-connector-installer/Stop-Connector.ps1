$InstallDir = $PSScriptRoot
$PidFile = Join-Path $InstallDir "connector.pid"
if (-not (Test-Path $PidFile)) { exit 0 }

$ConnectorPid = 0
[void][int]::TryParse((Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1), [ref]$ConnectorPid)
if ($ConnectorPid) {
    $ProcessInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ConnectorPid" -ErrorAction SilentlyContinue
    if ($ProcessInfo -and $ProcessInfo.CommandLine -like "*connector.mjs*") {
        Stop-Process -Id $ConnectorPid -Force -ErrorAction SilentlyContinue
    }
}
Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
