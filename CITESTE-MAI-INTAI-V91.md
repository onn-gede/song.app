# SongApp v91 · 0.23.0

Versiune cumulativă: include integral v89 și v90, chiar dacă nu au fost instalate.

## Actualizare

1. Oprește SongApp și conectorul FreeShow cu `Ctrl + C`.
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

## Important: înlocuiește conectorul FreeShow

Din `Administrare` descarcă din nou `Conector FreeShow · Windows`, extrage-l peste folderul vechi și repornește `PORNESTE-CONNECTOR.cmd`.

## Noul export direct în FreeShow

Butonul `Sincronizează și creează programul` execută un singur flux:

1. citește biblioteca FreeShow;
2. identifică o cântare creată anterior de SongApp după identitatea internă;
3. pentru conținutul vechi fără identitate SongApp, caută și după titlul exact;
4. reutilizează cântările existente și creează numai cântările lipsă;
5. actualizează versurile cântărilor gestionate de SongApp;
6. creează sau reconstruiește Project-ul FreeShow al întâlnirii;
7. denumește proiectul cu titlul și data/ora din SongApp;
8. adaugă prezentările în ordinea programului și deschide proiectul.

Duplicate vechi deja existente sunt semnalate, dar nu sunt șterse automat.

## Instalare și diagnostic FreeShow

În `Administrare` există acum și `Instrucțiuni FreeShow`, cu linkurile oficiale pentru SongApp, FreeShow, Node.js LTS, API și versiunile FreeShow.
