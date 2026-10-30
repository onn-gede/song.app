# SongApp v69 — 0.11.4

Fotografia bisericii este mare, în fundal în dreapta, conform previzualizării aprobate. Opacitatea a fost redusă de la 60% în preview la 48%, cu margini estompate. Pe mobil fotografia rămâne discretă în zona superioară, iar formularul și programele sunt afișate pe o coloană.

Actualizare peste v68 (0.11.3):
1. Oprește aplicația cu Ctrl+C în PowerShell.
2. Extrage conținutul arhivei în D:\Apps\song.app și acceptă înlocuirea fișierelor.
3. Rulează:

```powershell
Set-Location "D:\Apps\song.app"
npm run build
if ($LASTEXITCODE -eq 0) { npm run local }
```

Nu este necesar SQL sau npm ci. Baza de date și .env.local rămân cele existente. Arhiva conține doar fișierele acestei actualizări; nu este o instalare completă. Nu se face push sau deploy.
