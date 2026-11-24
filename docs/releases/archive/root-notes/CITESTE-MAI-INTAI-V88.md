# SongApp v88 · 0.20.2

Această versiune corectează trimiterea programului în FreeShow.

## Actualizare

1. Oprește SongApp și conectorul cu `Ctrl + C`.
2. Copiază conținutul folderului `02-APLICATIE` peste `D:\Apps\song.app` și păstrează `.env.local`.
3. Rulează:

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm test
npm run build
```

Nu există modificări SQL și nu este necesar deploy pentru testarea integrării.

## Utilizare FreeShow

1. Pornește FreeShow și păstrează REST API activ.
2. Pornește `PORNESTE-FREESHOW-CONNECTOR.cmd` și lasă fereastra deschisă.
3. În SongApp, la `FreeShow local`, folosește `http://127.0.0.1:5510/freeshow`.
4. Lasă cheia necompletată și apasă `Trimite programul`.

Programul este creat în categoria `SongApp`, se deschide imediat în FreeShow și este selectat automat.
