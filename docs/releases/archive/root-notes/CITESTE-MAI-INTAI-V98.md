# SongApp v98 · 0.27.0

Acest update nu necesită SQL nou.

## Ce se schimbă

- exportul PPTX este vizibil lângă versurile cântării;
- dacă există deja un PPT/PPTX încărcat și confirmat, este afișată descărcarea fișierului existent; o înregistrare fără fișier nu mai blochează exportul nou;
- existența este verificată și în Storage: importurile vechi care păstrau numai textul nu mai produc linkuri 404;
- importul acceptă atât fișierele `.show` SongApp, cât și exporturile native FreeShow;
- importul din linkuri păstrează strofele/refrenele structurate, fără a copia etichetele în versuri;
- butonul conectorului se numește **FreeShow Sync**;
- sesiunile Supabase expirate sunt curățate automat, fără erori repetate de refresh token.

## Validare locală

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm test
npm run build
npm run local
```

În browser, reîncarcă pagina cu `Ctrl+F5`. Dacă aveai o sesiune veche, aplicația te va trimite o singură dată la autentificare.
