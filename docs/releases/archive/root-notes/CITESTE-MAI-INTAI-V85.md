# SongApp v85 · 0.19.1

Actualizare locală, fără modificări SQL.

## Ce s-a schimbat

- căutarea pentru adăugarea unei cântări într-un playlist folosește aceeași prezentare ca programul normal;
- rezultatele afișează colecția, numărul, culoarea, tonalitatea și numărul de strofe;
- sunt disponibile preview-ul versurilor, calendarul/istoricul și filtrele avansate;
- aceeași cântare este marcată imediat ca deja adăugată în playlist.

## Instalare locală

Înlocuiește aplicația cu conținutul folderului `02-APLICATIE`, păstrând fișierul local `.env.local`, apoi rulează:

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm test
npm run build
npm run local
```

Nu este necesară rularea unui script SQL pentru această actualizare.
