# SongApp v87 · 0.20.1

Această versiune repară legătura din browser cu FreeShow printr-un conector care rulează numai pe calculatorul bisericii.

## Actualizare

1. Oprește SongApp și conectorul vechi cu `Ctrl + C`.
2. Copiază conținutul folderului `02-APLICATIE` peste `D:\Apps\song.app` și păstrează fișierul `.env.local` existent.
3. Rulează:

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm test
npm run build
```

Nu este nevoie de SQL și nu este nevoie de deploy pentru testarea locală.

## Pornire la biserică

1. Pornește FreeShow și lasă activ REST API în `Settings → Connections`.
2. În folderul SongApp, deschide `PORNESTE-FREESHOW-CONNECTOR.cmd` și lasă fereastra neagră deschisă.
3. Deschide SongApp în browser, intră într-un program și alege `FreeShow local`.
4. Adresa trebuie să fie `http://127.0.0.1:5510/freeshow`.
5. Cheia API rămâne goală dacă nu ai configurat una în FreeShow.
6. Apasă `Testează conexiunea`, apoi `Trimite programul`.

Alternativ, conectorul poate fi pornit din PowerShell:

```powershell
Set-Location "D:\Apps\song.app"
npm run freeshow:bridge
```

Conectorul ascultă numai pe `127.0.0.1`, transmite comenzile către FreeShow pe portul `5506` și permite accesul doar din SongApp local sau `https://songappbcb.netlify.app`.

Nu există modificări SQL în această versiune.
