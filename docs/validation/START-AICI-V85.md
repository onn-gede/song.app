# SongApp v85 · 0.19.1

Aceasta este o actualizare locală mică peste v84. Nu modifică baza de date și nu necesită un script SQL.

## Ordinea locală

1. Oprește aplicația cu `Ctrl + C`.
2. Copiază conținutul folderului `02-APLICATIE` peste `D:\Apps\song.app`.
3. Păstrează fișierul existent `D:\Apps\song.app\.env.local`.
4. Rulează:

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm test
npm run build
npm run local
```

## Verificare

Deschide un playlist și caută o cântare. Rezultatul trebuie să afișeze colecția și numărul, tonalitatea, strofele, preview-ul versurilor, calendarul și filtrele avansate, la fel ca în programul normal.
