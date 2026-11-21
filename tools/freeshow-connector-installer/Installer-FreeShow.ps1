$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$Green = [System.Drawing.Color]::FromArgb(38, 98, 76)
$Light = [System.Drawing.Color]::FromArgb(246, 249, 244)
$Text = [System.Drawing.Color]::FromArgb(28, 55, 42)
$DefaultDir = Join-Path $env:LOCALAPPDATA "SongApp FreeShow Connector"

function New-Label([string]$Value, [int]$X, [int]$Y, [int]$Width, [int]$Height, [float]$Size = 10, [bool]$Bold = $false) {
    $Control = New-Object System.Windows.Forms.Label
    $Control.Text = $Value
    $Control.Location = New-Object System.Drawing.Point($X, $Y)
    $Control.Size = New-Object System.Drawing.Size($Width, $Height)
    $Control.ForeColor = $Text
    $FontStyle = if ($Bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $Control.Font = New-Object System.Drawing.Font("Segoe UI", $Size, $FontStyle)
    return $Control
}

function New-Shortcut([string]$Path, [string]$Target, [string]$Arguments, [string]$WorkingDirectory, [int]$WindowStyle = 7) {
    $Shell = New-Object -ComObject WScript.Shell
    $Shortcut = $Shell.CreateShortcut($Path)
    $Shortcut.TargetPath = $Target
    $Shortcut.Arguments = $Arguments
    $Shortcut.WorkingDirectory = $WorkingDirectory
    $Shortcut.WindowStyle = $WindowStyle
    $Shortcut.Description = "SongApp - Conector FreeShow"
    $Shortcut.Save()
}

function PowerShell-Arguments([string]$ScriptPath) {
    return "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
}

$Form = New-Object System.Windows.Forms.Form
$Form.Text = "SongApp - Instalare conector FreeShow"
$Form.ClientSize = New-Object System.Drawing.Size(650, 440)
$Form.StartPosition = "CenterScreen"
$Form.FormBorderStyle = "FixedDialog"
$Form.MaximizeBox = $false
$Form.BackColor = $Light
$Form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

$Header = New-Object System.Windows.Forms.Panel
$Header.Location = New-Object System.Drawing.Point(0, 0)
$Header.Size = New-Object System.Drawing.Size(650, 82)
$Header.BackColor = $Green
$HeaderTitle = New-Label "SongApp BCBgiroc" 25 14 580 30 17 $true
$HeaderTitle.ForeColor = [System.Drawing.Color]::White
$HeaderSub = New-Label "Conector local pentru FreeShow" 27 48 560 22 10 $false
$HeaderSub.ForeColor = [System.Drawing.Color]::FromArgb(225, 240, 230)
$Header.Controls.AddRange(@($HeaderTitle, $HeaderSub))
$Form.Controls.Add($Header)

$Content = New-Object System.Windows.Forms.Panel
$Content.Location = New-Object System.Drawing.Point(0, 82)
$Content.Size = New-Object System.Drawing.Size(650, 300)
$Content.BackColor = $Light
$Form.Controls.Add($Content)

$Back = New-Object System.Windows.Forms.Button
$Back.Text = "< Înapoi"
$Back.Location = New-Object System.Drawing.Point(335, 395)
$Back.Size = New-Object System.Drawing.Size(90, 32)
$Back.Enabled = $false
$Next = New-Object System.Windows.Forms.Button
$Next.Text = "Următorul >"
$Next.Location = New-Object System.Drawing.Point(435, 395)
$Next.Size = New-Object System.Drawing.Size(105, 32)
$Next.BackColor = $Green
$Next.ForeColor = [System.Drawing.Color]::White
$Next.FlatStyle = "Flat"
$Cancel = New-Object System.Windows.Forms.Button
$Cancel.Text = "Anulează"
$Cancel.Location = New-Object System.Drawing.Point(550, 395)
$Cancel.Size = New-Object System.Drawing.Size(85, 32)
$Form.Controls.AddRange(@($Back, $Next, $Cancel))

$Welcome = New-Object System.Windows.Forms.Panel
$Welcome.Dock = "Fill"
$Welcome.Controls.Add((New-Label "Bine ai venit" 35 28 560 35 19 $true))
$Welcome.Controls.Add((New-Label "Acest program instalează conectorul care permite aplicației SongApp LIVE să comunice în siguranță cu FreeShow de pe același calculator." 38 82 550 62 11 $false))
$Welcome.Controls.Add((New-Label "Nu sunt necesare drepturi de administrator. Este necesar Node.js LTS." 38 166 550 28 10 $true))
$NodeLink = New-Object System.Windows.Forms.LinkLabel
$NodeLink.Text = "Descarcă Node.js LTS"
$NodeLink.Location = New-Object System.Drawing.Point(38, 206)
$NodeLink.Size = New-Object System.Drawing.Size(180, 25)
$NodeLink.LinkColor = $Green
$NodeLink.Add_LinkClicked({ Start-Process "https://nodejs.org/en/download/" })
$FreeShowLink = New-Object System.Windows.Forms.LinkLabel
$FreeShowLink.Text = "Descarcă FreeShow"
$FreeShowLink.Location = New-Object System.Drawing.Point(230, 206)
$FreeShowLink.Size = New-Object System.Drawing.Size(180, 25)
$FreeShowLink.LinkColor = $Green
$FreeShowLink.Add_LinkClicked({ Start-Process "https://freeshow.app/downloads" })
$Welcome.Controls.AddRange(@($NodeLink, $FreeShowLink))

$Options = New-Object System.Windows.Forms.Panel
$Options.Dock = "Fill"
$Options.Visible = $false
$Options.Controls.Add((New-Label "Opțiuni de instalare" 35 22 560 35 17 $true))
$Options.Controls.Add((New-Label "Folder de instalare" 38 70 300 22 10 $true))
$PathBox = New-Object System.Windows.Forms.TextBox
$PathBox.Location = New-Object System.Drawing.Point(40, 96)
$PathBox.Size = New-Object System.Drawing.Size(475, 28)
$PathBox.Text = $DefaultDir
$Browse = New-Object System.Windows.Forms.Button
$Browse.Location = New-Object System.Drawing.Point(525, 94)
$Browse.Size = New-Object System.Drawing.Size(82, 30)
$Browse.Text = "Alege..."
$Browse.Add_Click({
    $Picker = New-Object System.Windows.Forms.FolderBrowserDialog
    $Picker.Description = "Alege folderul de instalare"
    if ($Picker.ShowDialog() -eq "OK") { $PathBox.Text = Join-Path $Picker.SelectedPath "SongApp FreeShow Connector" }
})
$AutoStart = New-Object System.Windows.Forms.CheckBox
$AutoStart.Text = "Pornește automat conectorul odată cu Windows"
$AutoStart.Location = New-Object System.Drawing.Point(40, 150)
$AutoStart.Size = New-Object System.Drawing.Size(440, 28)
$AutoStart.Checked = $true
$StartNow = New-Object System.Windows.Forms.CheckBox
$StartNow.Text = "Pornește conectorul după finalizarea instalării"
$StartNow.Location = New-Object System.Drawing.Point(40, 184)
$StartNow.Size = New-Object System.Drawing.Size(440, 28)
$StartNow.Checked = $true
$DesktopShortcut = New-Object System.Windows.Forms.CheckBox
$DesktopShortcut.Text = "Creează scurtătură pe Desktop"
$DesktopShortcut.Location = New-Object System.Drawing.Point(40, 218)
$DesktopShortcut.Size = New-Object System.Drawing.Size(440, 28)
$Options.Controls.AddRange(@($PathBox, $Browse, $AutoStart, $StartNow, $DesktopShortcut))

$Complete = New-Object System.Windows.Forms.Panel
$Complete.Dock = "Fill"
$Complete.Visible = $false
$Complete.Controls.Add((New-Label "Instalare finalizată" 35 34 560 35 19 $true))
$CompleteMessage = New-Label "" 38 92 560 100 11 $false
$Complete.Controls.Add($CompleteMessage)
$Complete.Controls.Add((New-Label "În SongApp folosește adresa: http://127.0.0.1:5510/freeshow" 38 205 560 28 10 $true))

$Content.Controls.AddRange(@($Welcome, $Options, $Complete))
$Form.Tag = 0

function Show-WizardStep([int]$Value) {
    $Form.Tag = $Value
    $Welcome.Visible = ($Value -eq 0)
    $Options.Visible = ($Value -eq 1)
    $Complete.Visible = ($Value -eq 2)

    if ($Value -eq 0) {
        $Welcome.BringToFront()
        $Back.Enabled = $false
        $Next.Text = "Următorul >"
    } elseif ($Value -eq 1) {
        $Options.BringToFront()
        $Back.Enabled = $true
        $Next.Text = "Instalează"
    } else {
        $Complete.BringToFront()
        $Back.Enabled = $false
        $Next.Text = "Închide"
    }
}

$Install = {
    $Node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $Node) {
        $Answer = [System.Windows.Forms.MessageBox]::Show("Node.js LTS nu este instalat. Dorești să deschizi pagina oficială de descărcare?", "Node.js necesar", "YesNo", "Warning")
        if ($Answer -eq [System.Windows.Forms.DialogResult]::Yes) { Start-Process "https://nodejs.org/en/download/" }
        return $false
    }

    $InstallDir = $PathBox.Text.Trim()
    if (-not $InstallDir) { throw "Alege folderul de instalare." }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

    $OldStop = Join-Path $InstallDir "Stop-Connector.ps1"
    if (Test-Path $OldStop) { & $OldStop }
    foreach ($File in @("connector.mjs", "Start-Connector.ps1", "Stop-Connector.ps1", "Uninstall-Connector.ps1", "CITESTE-MAI-INTAI.txt")) {
        Copy-Item (Join-Path $PSScriptRoot $File) (Join-Path $InstallDir $File) -Force
    }

    $PowerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $StartScript = Join-Path $InstallDir "Start-Connector.ps1"
    $StopScript = Join-Path $InstallDir "Stop-Connector.ps1"
    $UninstallScript = Join-Path $InstallDir "Uninstall-Connector.ps1"
    $ProgramsFolder = Join-Path ([Environment]::GetFolderPath("Programs")) "SongApp FreeShow"
    New-Item -ItemType Directory -Path $ProgramsFolder -Force | Out-Null
    # Curăță numai scurtăturile conectorului din instalările parțiale/vechi.
    Remove-Item (Join-Path $ProgramsFolder "*.lnk") -Force -ErrorAction SilentlyContinue
    # WScript.Shell din Windows PowerShell 5.1 poate refuza salvarea unor
    # fișiere .lnk ale căror nume conțin diacritice. Wizardul rămâne în
    # română, iar numele tehnice ale scurtăturilor sunt păstrate în ASCII.
    New-Shortcut (Join-Path $ProgramsFolder "Porneste conectorul.lnk") $PowerShell (PowerShell-Arguments $StartScript) $InstallDir
    New-Shortcut (Join-Path $ProgramsFolder "Opreste conectorul.lnk") $PowerShell (PowerShell-Arguments $StopScript) $InstallDir
    New-Shortcut (Join-Path $ProgramsFolder "Dezinstaleaza conectorul.lnk") $PowerShell (PowerShell-Arguments $UninstallScript) $InstallDir 1

    $StartupLink = Join-Path ([Environment]::GetFolderPath("Startup")) "SongApp FreeShow Connector.lnk"
    if ($AutoStart.Checked) { New-Shortcut $StartupLink $PowerShell (PowerShell-Arguments $StartScript) $InstallDir }
    else { Remove-Item $StartupLink -Force -ErrorAction SilentlyContinue }

    $DesktopLink = Join-Path ([Environment]::GetFolderPath("Desktop")) "SongApp FreeShow Connector.lnk"
    if ($DesktopShortcut.Checked) { New-Shortcut $DesktopLink $PowerShell (PowerShell-Arguments $StartScript) $InstallDir }
    else { Remove-Item $DesktopLink -Force -ErrorAction SilentlyContinue }

    if ($StartNow.Checked) { & $StartScript }
    $CompleteMessage.Text = "Conectorul a fost instalat în:`r`n$InstallDir`r`n`r`nComenzile Pornire, Oprire și Dezinstalare sunt disponibile în meniul Start."
    return $true
}

$Next.Add_Click({
    try {
        $CurrentStep = [int]$Form.Tag
        if ($CurrentStep -eq 0) {
            Show-WizardStep 1
        } elseif ($CurrentStep -eq 1) {
            $Next.Enabled = $false; $Back.Enabled = $false; $Cancel.Enabled = $false
            if (& $Install) {
                Show-WizardStep 2
                $Next.Enabled = $true
            } else {
                $Next.Enabled = $true; $Back.Enabled = $true; $Cancel.Enabled = $true
            }
        } else { $Form.Close() }
    } catch {
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "Instalarea nu a reușit", "OK", "Error") | Out-Null
        $Next.Enabled = $true; $Back.Enabled = $true; $Cancel.Enabled = $true
    }
})
$Back.Add_Click({
    if ([int]$Form.Tag -eq 1) { Show-WizardStep 0 }
})
$Cancel.Add_Click({ $Form.Close() })
Show-WizardStep 0
[void]$Form.ShowDialog()
