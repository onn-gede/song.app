# SongApp v70 — 0.11.5

În pagina de login, programul în curs apare primul (dacă există), apoi programele viitoare de la cel mai apropiat, iar ultimul program încheiat apare jos. Limita rămâne 4 programe. Fotografia aprobată în v69 rămâne identică.

Actualizare peste v69: oprește aplicația cu Ctrl+C, extrage peste D:\Apps\song.app și acceptă înlocuirea fișierelor.

```powershell
Set-Location "D:\Apps\song.app"
npm run build
if ($LASTEXITCODE -eq 0) { npm run local }
```

Fără SQL sau npm ci. Nu s-a făcut push/deploy.
