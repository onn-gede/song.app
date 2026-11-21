# SongApp v90 · 0.22.0

Versiune cumulativă: include integral modificările v89, chiar dacă v89 nu a fost instalată.

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

## FreeShow

- `Trimite programul` creează câte o prezentare FreeShow distinctă pentru fiecare cântare și pentru fiecare moment care are text;
- prezentările sunt trimise în ordinea programului;
- în slide-uri ajung numai versurile/textul, fără titlul cântării și fără etichete precum `Strofa 1`, `Refren` sau `Bridge`;
- ultima prezentare trimisă rămâne selectată în FreeShow;
- `FreeShow pachet` descarcă un ZIP cu fișiere `.show` distincte, numerotate în ordinea programului;
- conectorul Windows inclus în această versiune trebuie să îl înlocuiască pe cel vechi.

FreeShow REST nu întoarce ID-ul prezentărilor create. Din acest motiv, versiunea aceasta le creează distinct în biblioteca FreeShow, dar nu le grupează încă automat într-un Project FreeShow.

## Proiecție SongApp

Sunt incluse și funcțiile v89: proiecție separată fără controale, control de pe ecranul operatorului, `F5`, `Shift + F5`, închidere cu `Esc` și descărcarea conectorului din Administrare.
