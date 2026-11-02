# SongApp v76 — 0.12.5 — Refactorizare afișare program

Actualizare peste v75. Fără SQL, dependențe noi, push sau deploy.

## Ce s-a schimbat
- ProgramCard este separat de MeetingProgramBoard: cardul gestionează editarea informațiilor, iar lista păstrează mutarea/drag și gruparea principal/backup.
- ProgramSongTags este comun cardurilor din editor și din afișarea publică de rezervă.
- lib/program-display.ts centralizează tonalitatea efectivă, BPM, selecția colecției, strofele, structura și marcajul de cântare în comun. Printul și generarea slide-urilor folosesc aceleași reguli.
- Tipul PresentationSlide nu mai este duplicat în componenta prezentării.
- Tipurile de momente din card și print folosesc lista comună deja existentă.
- Publicul folosea deja MeetingProgramBoard pentru lista principală; refactorizarea păstrează acest flux și aliniază și componenta publică alternativă.

Nu schimbă permisiunile, API-urile de salvare, drag-and-drop sau schema bazei. Numărul de strofe în prezentare se calculează în continuare din secțiunile originale, cu prioritate pentru valoarea manuală; repetarea refrenului nu îl mărește. Câmpurile necunoscute rămân necunoscute.

## Validare
101 teste trecute, inclusiv două teste noi de metadate și concordanță listă/prezentare. Build de producție Webpack trecut. TypeScript trecut și după curățarea importurilor/tipurilor duplicate.

Randare internă cu date de test a componentelor reale: card editabil și public, metadate print, controale ascunse pentru public, desktop 1440px și mobil 390px fără overflow orizontal, metadate vizibile la print. Acest test de randare nu trimite acțiuni reale în Supabase; salvările și gesturile pe dispozitive reale necesită confirmarea obișnuită locală. Nu a fost efectuat un test pe un iPhone fizic.

## Instalare locală
Oprește aplicația cu Ctrl+C. Extrage peste D:\Apps\song.app și acceptă înlocuirea fișierelor.

```powershell
Set-Location "D:\Apps\song.app"
npm run build
if ($LASTEXITCODE -eq 0) { npm run local }
```

Verifică un program existent: tonalitate aleasă, colecție/număr, marcaj comun, modificare solist/observații, mutare în backup, apoi vezi public și Print. Nu este necesar npm ci dacă v75 era instalat. Nu se rulează SQL pentru v76.
