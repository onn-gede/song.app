> Document istoric. Pentru importul actual din PPT folosește [IMPORT-PPT-V58.md](IMPORT-PPT-V58.md). Importul API CN parțial descris mai jos este blocat.

# SongApp v57 / 0.7.5 — actualizare locală

## Instalare în aceeași bază

1. Oprește aplicația locală (Ctrl+C). Extrage arhiva într-un folder nou și copiază `.env.local` din aplicația existentă. Nu schimba proiectul Supabase sau conturile.
2. În SQL Editor din același proiect Supabase rulează `supabase/updates/UPDATE-V57.sql`, după actualizările până la v56. Nu folosi `INSTALL-NEW.sql` pe baza existentă. SQL-ul adaugă funcțiile; importul cântărilor se execută separat, prin comanda de mai jos.
3. În PowerShell:

```powershell
Set-Location "D:\Apps\SongApp-local"
npm ci
npm run import:books
npm run build
npm run local
```

Continuă după ce fiecare comandă se încheie cu succes. Deschide http://localhost:3000. Nu este necesar Git, push sau deploy Netlify.

## Repararea celor două cărți

`npm run import:books` repară Cartea Roșie și reface Cartea Neagră. Separat: `npm run import:red-book` sau `npm run import:black-book`. Fișierele `.cmd` oferă aceleași comenzi.

Catalogul verificat din 29.10.2026 este inclus în `data/book-catalogs`, astfel încât rezultatul să nu depindă de descărcări sau de conversia PowerPoint pe laptop. Nu trebuie instalat LibreOffice. Pregătirea s-a făcut din API-ul https://www.cantaricrestine.ro/documentatie-api.php, exclusiv categoriile `cr` și `cn`. Fișierele PPT fără descriere API au fost convertite, apoi au fost citite slide-urile curente și casetele cu versuri, separat de titluri, note, numere și șablon.

| Destinație | Înregistrări API | Cântări distincte pregătite |
| --- | ---: | ---: |
| Cartea roșie - Cântările Evangheliei (`cr`) | 1200 | 601, numerotate 001–601 |
| Cartea Neagră - Cântările Evangheliei (`cn`) | 482 | 266 |

Cartea Neagră are 265 înregistrări numerotate (001–264 și 500, exact ca în sursă) și o cântare distinctă fără număr, „Așa cum sunt”. Variantele neenumerotate cu corespondent sigur sunt legate de aceeași piesă, fără dublare. Nu inventăm numerele care lipsesc din API. Cele 482 de înregistrări nu reprezintă 482 de cântări distincte.

Repararea înlocuiește versurile și structura pieselor din cărțile vizate cu cele din catalogul verificat. Păstrează tonalitățile, BPM, notele și legăturile programelor. Înainte de modificare, versurile și strofele vechi sunt copiate în tabelul privat `book_repair_backups_v57`. Dacă o piesă este împărțită cu o altă colecție și are altă versiune, importatorul separă versiunea cărții; programele cu acea sursă urmăresc versiunea corectă. Nu suprascrie versurile celeilalte colecții.

Sursele vechi care nu apar în catalogul confirmat sunt mutate într-o colecție de arhivă inactivă; istoricul programelor este păstrat. O piesă care rămâne numai în arhivă devine inactivă în căutare. Arhivarea are loc numai dacă toate piesele catalogului au fost confirmate. Copiile vechi cu același număr sunt păstrate în arhivă după alegerea deterministă a corespondentului canonic (identitatea API, apoi titlul și vechimea). Conflictele între o identitate API deja legată și alt număr sunt raportate și opresc această etapă.

Autentificarea folosește configurația privată existentă din `.env.local`. Dacă nu există o cheie service role, consola cere local emailul și parola unui cont SongApp cu drept de editare. Parola nu este afișată și nu se salvează. Nu trimite chei sau parole în chat.

Raportul se salvează în `.songapp-imports/books-v57/raport-*.json`. Stări: `created`, `repaired`, `existing`, `review`. După întreruperea conexiunii poți rula aceeași comandă; reluarea nu dublează piesele. Pentru verificarea catalogului fără conectare la bază: `node scripts/import-books.mjs --prepare-only`.

## Interfață și utilizare

- Paginația apare deasupra și dedesubtul listei; ambele păstrează filtrele. „Resetează filtrele” șterge și ordonarea selectată.
- Căutarea numerică tratează 063 și 63 la fel, în toate colecțiile. Potrivirile exacte apar primele. Dacă există filtre restrictive, poți relua căutarea în toate colecțiile prin linkul de lângă filtre.
- În program, rezultatele afișează variante distincte pe colecție, fiecare cu număr, culoare și buton de adăugare. Din bibliotecă, colecția se alege prin opțiuni vizibile în fereastra de adăugare.
- Adăugarea este confirmată din lista salvată; după succes căutarea se golește. La revenirea într-un tab de program, lista se actualizează. Reîncercarea unei cereri cu răspuns pierdut nu adaugă încă o copie.
- În Colecții alegi intensitatea fundalului tagului: 25%, 50%, 75%, 100%. Textul rămâne opac și lizibil. Liniile de identificare păstrează culoarea colecției.
- Momentele includ și „Cântare” și „Diverse”, cu o culoare aleasă la creare sau editare.
- Pe dashboard, „Vezi public” apare lângă „Prezintă” când programul are un link public activ. Eticheta stării are spațiu față de acțiuni.
- Administratorii pot respinge conturi inactive sau le pot elimina din lista de administrare. Eliminarea din listă păstrează identitatea și jurnalul; nu șterge istoricul activității sau autentificarea din Supabase. Accesul rămâne blocat.

Nu a fost efectuat push, deploy sau import în baza ta din această sesiune. Importul real pornește când rulezi comanda locală.

## Actualizarea catalogului în dezvoltare

Catalogul inclus este o fotografie a sursei din 29.10.2026. Pentru o recitire ulterioară, dezvoltatorul poate rula `node scripts/prepare-book-catalogs.mjs`, cu LibreOffice disponibil prin `soffice` sau variabila locală `SOFFICE_BIN`. Comanda pregătește fișierele JSON și nu scrie în Supabase. Compară modificările, rulează testele și apoi importatorul. Rularea obișnuită a aplicației nu descarcă periodic catalogul.
