# SongApp v86 · 0.20.0

Actualizare locală fără modificări SQL.

## Instalare

1. Oprește SongApp cu `Ctrl + C`.
2. Copiază conținutul folderului `02-APLICATIE` peste `D:\Apps\song.app` și păstrează `.env.local` existent.
3. Rulează:

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm test
npm run build
npm run local
```

## Test FreeShow pe PC-ul bisericii

1. Pornește FreeShow.
2. În FreeShow deschide `Settings → Connections` și activează REST API.
3. Deschide în SongApp un program și meniul `•••`.
4. Apasă `FreeShow local`.
5. Păstrează adresa `http://127.0.0.1:5506` și completează cheia API numai dacă ai configurat-o în FreeShow.
6. Apasă `Testează conexiunea`.
7. Dacă testul trece, apasă `Trimite programul`.

SongApp va crea sau actualiza prezentarea `SongApp · Titlul programului` și o va selecta în FreeShow.
