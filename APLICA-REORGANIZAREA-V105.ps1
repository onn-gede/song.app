$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

$RootPatterns = @(
  "ARHIVA-*-CONTINUT.txt",
  "CITESTE-MAI-INTAI-*.md",
  "README_FIX_*.md",
  "UPDATE-V4*.sql",
  "VERIFICARI-V*.md"
)

foreach ($Pattern in $RootPatterns) {
  Get-ChildItem -Path $ProjectRoot -Filter $Pattern -File -ErrorAction SilentlyContinue |
    Remove-Item -Force
}

$ExplicitLegacyFiles = @(
  "BOOTSTRAP-ADMIN.sql",
  "INSTALL-NEW.sql",
  "NETLIFY-SETUP.md",
  "VERIFICA-SECURITATE-V72.sql",
  "CLEANUP_NEXT16_PROXY.bat",
  "CLEANUP_NEXT16_PROXY.ps1"
)

foreach ($RelativePath in $ExplicitLegacyFiles) {
  $Target = Join-Path $ProjectRoot $RelativePath
  if (Test-Path $Target -PathType Leaf) {
    Remove-Item $Target -Force
  }
}

$MigrationRoot = Join-Path $ProjectRoot "supabase"
$CanonicalRoot = Join-Path $MigrationRoot "migrations"
Get-ChildItem -Path $MigrationRoot -Filter "[0-9][0-9][0-9]_*.sql" -File -ErrorAction SilentlyContinue |
  ForEach-Object {
    $Canonical = Join-Path $CanonicalRoot $_.Name
    if ((Test-Path $Canonical -PathType Leaf) -and
        ((Get-FileHash $_.FullName).Hash -eq (Get-FileHash $Canonical).Hash)) {
      Remove-Item $_.FullName -Force
    }
  }

$OldActionFiles = @(
  "app\(app)\import\actions.ts",
  "app\(app)\meetings\actions.ts",
  "app\(app)\playlists\actions.ts",
  "app\(app)\songs\actions.ts"
)

foreach ($RelativePath in $OldActionFiles) {
  $Target = Join-Path $ProjectRoot $RelativePath
  if (Test-Path $Target -PathType Leaf) {
    Remove-Item $Target -Force
  }
}

Write-Host "Reorganizarea v105 a fost aplicată. .env.local și datele aplicației nu au fost modificate." -ForegroundColor Green
