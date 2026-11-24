# SongApp v89 · 0.21.0

Această versiune adaugă proiecția separată controlată de pe ecranul operatorului și distribuirea conectorului local FreeShow din Administrare.

## Actualizare

1. Oprește SongApp și conectorul cu `Ctrl + C`.
2. Copiază conținutul folderului `02-APLICATIE` peste `D:\Apps\song.app` și păstrează `.env.local`.
3. Rulează:

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm test
npm run build
npm run local
```

Nu există modificări SQL.

## Proiecție pe două ecrane

- `F5` pornește proiecția separată; după prima alegere reutilizează ultimul ecran selectat.
- `Shift + F5` deschide prezentarea în tabul curent.
- ecranul de proiecție afișează numai conținutul;
- controalele anterior, următor, primul, ultimul, mărimea textului și `Am văzut` rămân pe ecranul operatorului;
- `Esc` închide complet fereastra de proiecție;
- închiderea panoului operatorului închide și proiecția.

## Conector FreeShow

În `Administrare` există opțiunea `Conector FreeShow · Windows`. Arhiva descărcată rulează independent de SongApp local și poate porni automat odată cu Windows.

Pentru utilizarea LIVE:

1. pornește FreeShow și activează API;
2. pornește conectorul local;
3. deschide `https://songappbcb.netlify.app`;
4. folosește adresa `http://127.0.0.1:5510/freeshow`.
