Write-Host "Cleaning old Next.js middleware files..."
Remove-Item -Force -ErrorAction SilentlyContinue .\middleware.ts, .\middleware.js, .\src\middleware.ts, .\src\middleware.js
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue .\.next
Write-Host "Done. Now run: npm run dev"
