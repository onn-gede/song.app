# SongApp v78 — 0.14.0

Pachet peste v77. Fără push/deploy și fără SQL executat pe proiectul real.

## Modificări
1. În Cântare → Editare → Ștergere definitivă poți șterge cântarea, confirmând cu STERGE. Ștergerea din baza de date este tranzacțională: cântarea, fișele atașamentelor și aparițiile din toate programele sunt eliminate. Nu există anulare; păstrează un backup înainte. Fișierele din Storage sunt șterse ulterior numai dacă nu mai sunt referite de altă fișă. O eroare Storage poate lăsa fișiere private orfane; nu reintroduce cântarea în bibliotecă.
2. Numerele eliberate prin ștergere sau renumerotare/mutare după instalarea SQL-ului sunt refolosite automat, înainte de alocarea unui număr nou. Numerele eliberate înainte de instalare nu pot fi reconstruite automat, dar le poți introduce manual. Se păstrează și formatul, de exemplu 063.
3. În Editare → Colecții și numere, pentru fiecare apartenență poți schimba colecția și numărul împreună. Un număr deja folosit în colecția țintă este refuzat. Număr gol = alocare automată. Aceeași cântare poate avea în continuare mai multe apartenențe.
4. În Colecții există secțiunea Momente, cu paginare, pentru editarea titlului, observațiilor și culorii momentelor din programele existente. Nu este un catalog nou de șabloane și nu schimbă colecțiile de cântări.
5. Acasă → Programe recente este ordonat după data CREĂRII, cel mai nou primul. Cardul separat al următorului program rămâne cronologic.
6. Structura goală nu mai ocupă un tag în listă/public. Editorii au o iconiță mică pentru completare. Dacă există o structură implicită a cântării, aceasta rămâne vizibilă. Spațiile singure sunt tratate ca gol.
7. La pregătire, butonul mic Versuri este în același grup de taguri, fără rând dedicat. Pe ecrane înguste tagurile se pot împărți natural pe mai multe rânduri. Pentru piese exclusiv PPT/PDF preview-ul explică lipsa versurilor text.

## Aplicare
Oprește serverul, extrage peste D:\Apps\song.app. Păstrează .env.local.

SQL necesar: supabase/updates/UPDATE-V78.sql, pe baza SongApp existentă actualizată până la v74. NU INSTALL-NEW.sql. SQL-ul nu șterge automat cântări; creează funcțiile și evidența numerelor reutilizabile.

Dacă rulezi UPDATE-V78.sql în proiectul Supabase folosit și de site, modificările SQL vor fi active și pentru live, chiar fără deploy. Pentru test complet izolat folosește o bază separată. Eu nu am executat SQL pe proiectul real.

După aplicarea SQL-ului în baza pe care alegi să testezi:

```powershell
Set-Location "D:\Apps\song.app"
npm test
if ($LASTEXITCODE -eq 0) { npm run build }
if ($LASTEXITCODE -eq 0) { npm run local }
```

Nu sunt dependențe noi față de v77. Fără npm ci dacă v77 funcționa deja. Nu se face deploy.
