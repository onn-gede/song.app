# SongApp v77 — 0.13.0 — Calup de stabilitate și utilizare pe mobil

Un singur pachet de actualizare peste v76 / 0.12.5. Fără migrare SQL, dependențe noi, push sau deploy.

## Aplicare locală
1. Oprește aplicația cu Ctrl+C.
2. Extrage conținutul arhivei în D:\Apps\song.app și acceptă înlocuirea fișierelor. Păstrează .env.local.
3. Rulează:

```powershell
Set-Location "D:\Apps\song.app"
npm test
if ($LASTEXITCODE -eq 0) { npm run build }
if ($LASTEXITCODE -eq 0) { npm run local }
```

Nu este necesar npm ci dacă ai instalat v76. Nu rula din nou SQL-urile anterioare pentru această actualizare. Nu există comenzi de publicare în acest ghid.

## Tot ce include acest calup
- Transport comun pentru cererile interactive: sesiune expirată, acces refuzat, prea multe cereri, HTML în loc de JSON, conexiune întreruptă și timeout de 20 secunde.
- Salvările prin API NU sunt repetate automat. La un rezultat incert apare instrucțiunea să verifici programul înainte să repeți acțiunea. Adăugarea unei cântări păstrează identificatorul de retry existent.
- Aplicat la adăugare, mutare, marcaj comun, căutare, opțiuni de filtrare, preview de versuri și citirea snapshotului programului.
- Banner discret când browserul detectează lipsa conexiunii și după revenire. Nu ascunde pagina, nu salvează formulare offline și nu le retrimite automat.
- Programul editabil cere snapshot nou și căutarea își invalidează cache-ul la evenimentul online, precum și la focusul existent. Nu adaugă polling continuu.
- Ștergerea are protecție pentru clic repetat, buton dezactivat în timpul cererii și eroare vizibilă dacă operațiunea eșuează.
- Fereastra Program nou folosește dialog nativ: focus izolat, Escape, închidere și întoarcerea focusului. Blocarea în timpul salvării și identificatorul idempotent rămân.
- Pe dispozitive fără hover, preview-ul versurilor este un dialog derulabil, cu închidere explicită. Pe desktop rămâne tooltip, cu trecere de la buton la conținut și derulare în interior.
- Căutarea are limită de 300 de caractere, ștergere rapidă, reîncercare și identificatori unici pentru fiecare instanță a panoului. Rezultatele cererilor anulate nu pot înlocui cererea nouă. Filtrele alese sunt păstrate la adăugare.
- Autentificare cu câmp email fără autocapitalizare/autocorectare și autocomplete pentru managerul de parole.
- Pe ecrane mici, font de 16px în controalele principale pentru reducerea zoomului la tastare; texte lungi și observații care se pot împărți pe rânduri.
- Controale tactile de minimum 44px pentru principalele acțiuni și meniu, fără a mări butoanele desktop la mouse.
- Mișcări reduse respectate; modificarea rămâne marcată cu un chenar static cât timp clasa temporară este activă.
- Pagini de recuperare pentru erori în zona autentificată și în programul partajat, cu reîncercare și întoarcere la pagina potrivită. Nu afișează detaliile interne ale erorii.

## Verificare pe telefon
1. În browser: login și navigare, căutare rapidă și filtre, două adăugări consecutive.
2. Solist/observații: salvare și închiderea editorului, marcaj comun, mutări principal/backup.
3. Preview versuri: deschidere, derulare, închidere; PPT/PDF rămân fișiere atașate.
4. Întrerupe conexiunea; verifică bannerul și mesajele. Restabilește conexiunea și verifică ultima modificare înainte de retry.
5. Program public cu/fără drepturi: vizitatorii doar vizualizează/propun dacă ON; editorii pot edita independent.
6. Verifică Print pe calculator.

http://localhost:3000 de pe telefon NU este calculatorul tău. Acest pachet nu este publicat pe site, deci instalarea PWA de pe adresa Netlify rămâne versiunea deja publicată. Testarea PWA iPhone/Android a acestei versiuni necesită ulterior o adresă HTTPS de test, accesibilă telefonului. Nu s-a făcut deploy pentru asta.

## Securitate și limite reale
Auditul npm al pachetului: 0 vulnerabilități cunoscute la verificare. Nu reprezintă o garanție pentru vulnerabilități viitoare sau o certificare de securitate.

Setările Authentication din Supabase (signup dezactivat dacă doar adminii creează conturi, politica parolelor, rate limits disponibile) trebuie confirmate în dashboard. Nu pot fi deduse din testele locale și nu au fost modificate. Păstrează backupurile separat și verifică restaurarea într-o bază izolată.

Limitele per link din SQL v74, deja aplicate de tine, reduc spamul; nu identifică individual vizitatorul și nu înlocuiesc protecția DDoS. O politică CSP completă cu nonce ar cere verificarea tuturor resurselor PDF/Next/Supabase; acest calup păstrează politica existentă care a fost testată, fără a pretinde protecție CSP completă.

Nu sunt introduse funcționare offline cu date private, notificări push garantate când aplicația este închisă, conturi de dezvoltator sau servicii cu abonament.
