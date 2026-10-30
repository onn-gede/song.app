# SongApp v64 / 0.10.0 — Export, backup și restaurare

## Instalare peste v63
1. Oprește aplicația locală (Ctrl+C).
2. Extrage fișierele din acest ZIP peste D:\Apps\song.app, cu înlocuire. Păstrează .env.local și local-assets.
3. În SQL Editor al ACELUIAȘI proiect Supabase rulează supabase/updates/UPDATE-V64.sql.
   Dacă nu ai aplicat v62 și v63, rulează UPDATE-V62.sql, apoi UPDATE-V63.sql înainte de V64.
   Nu rula INSTALL-NEW.sql pe baza existentă.
4. PowerShell:
   Set-Location "D:\Apps\song.app"
   npm ci
   npm run build
   Numai dacă buildul reușește:
   npm run local

Nu sunt necesare chei noi. Nu se face push sau deploy automat.

## Export program
Program → meniul ••• → Export program ↓.
Arhiva include PROGRAM.html, datele programului și fișierele asociate cântărilor din principal și rezervă (PPT/PDF și celelalte atașamente).
Dezarhivează pachetul, apoi deschide PROGRAM.html. Echipa, soliștii, observațiile, tonalitatea, structura și ordinea sunt lizibile fără autentificare. Legăturile către fișiere funcționează din dosarul extras.
Acest export este disponibil utilizatorilor activi care pot vedea programul. Rezerva apare separat și nu este prezentată ca fiind cântată.

## Backup complet al conținutului
Administrare → Backup și restaurare → Descarcă backup complet.
Include cântări (active și inactive), versuri, colecții, categorii, legături, programe, echipe, soliști, observații, linkuri publice, propuneri, date auxiliare biblice, referințe de import și toate fișierele înregistrate, inclusiv PPT/PDF.
Conturile/profilele, jurnalul, istoricul unificărilor/reparațiilor și sincronizărilor sunt incluse ca evidență. Nu se restaurează parole, conturi, roluri, jurnalul vechi sau cozi de lucru. Nu include configurația proiectului Supabase, chei, sesiuni ori codul aplicației.
Este un backup al conținutului SongApp, nu o imagine a infrastructurii Supabase. Păstrează separat configurația și metodele de recuperare a conturilor.
Dacă un fișier înregistrat nu poate fi descărcat, operațiunea se oprește și NU livrează o arhivă incompletă drept backup reușit.
Arhivele au nume distincte, cu dată și identificator. Păstrează pagina deschisă până la finalizare. Limita curentă: 500 MB ZIP / 1 GB decomprimat, maximum 25 MB pe atașament (limita bucketului).
Arhiva conține date personale și poate conține linkuri publice: păstreaz-o într-un loc privat. ZIP-ul nu este criptat.

## Restaurare cu preview
Disponibilă numai administratorilor activi. Alege o arhivă produsă de v64, verifică sumarul și înregistrările/câmpurile înainte/după, bifează confirmarea și apasă Confirmă restaurarea.
Datele sunt adăugate sau actualizate după identificatorul original. Nu se șterge nimic doar pentru că lipsește din arhivă; nu este un reset la o fotografie exactă a bazei.
Preview-ul execută validarea reală într-o tranzacție anulată: erorile de unicitate, relațiile lipsă și conflictele opresc restaurarea. Nu se unifică automat colecții/cântări cu identificatori diferiți. Astfel de conflicte trebuie rezolvate înainte de confirmare.
Preview-ul este legat de administrator, de conținut și de starea bazei, este de unică folosință și expiră după o oră. Dacă se modifică datele între timp, trebuie generat din nou.
Fișierele se verifică SHA-256, se încarcă pe căi separate și nu suprascriu fișierele existente. După încărcare, datele se aplică atomic. Dacă aplicarea eșuează, datele rămân intacte; fișiere nelegate pot rămâne în Storage și pot ocupa spațiu.
Restaurarea păstrează toate categoriile, include rezerva și păstrează ordinea. Linkurile publice primesc starea din arhivă: verifică acest lucru în preview. Identitățile autorilor care nu există în proiectul destinație devin nespecificate; conturile nu sunt create automat.
Restaurarea trebuie făcută pe o schemă compatibilă v64, cu un administrator activ. Instalarea și conturile unui proiect Supabase nou se configurează separat.

## Verificări locale
86 teste automate trecute: integritatea ZIP, modificări/coruperi/atașamente lipsă, document offline, permisiuni, preview fără modificări persistente, revenire după eroare, identificatori duplicați, conflicte simultane, restaurare unică și schimbarea ordinii.
Build de producție Webpack + TypeScript trecute. Browser: descărcare program/backup cu atașament, preview înainte/după, confirmare explicită, încărcare și aplicare, ZIP deteriorat, mobil și acces anonim refuzat.
Testele folosesc bază locală și servicii simulate; nu s-a restaurat nimic în baza ta reală și nu s-a făcut deploy.
