# Document istoric v42 — nu se aplică fluxului curent de import din link

# SongApp v42 · versiunea 0.2.0

Aplicație pentru biblioteca de cântări și pregătirea programelor bisericii.
Next.js 16 / React 19 / TypeScript / Supabase. Necesită Node.js >=22.14.

## Ce include acest calup

- Bibliotecă paginată, 50 de cântări pe pagină, filtre/sortare în PostgreSQL și total real.
- Navigare adaptată rolului, pagina activă evidențiată, meniu compact pe telefon.
- Conturile inactive nu mai pot citi tabelele interne sau apela funcțiile interne de căutare. Acțiunile de editare verifică separat profilul activ și rolul.
- Sincronizare externă persistentă: coadă, progres salvat după fiecare pagină/cântare, erori separate, anulare și reluare după întreruperea procesului. O singură rulare activă pentru fiecare sursă.
- Opțiunea „Actualizează existente” este respectată: fără ea, se păstrează conținutul existent. Conținutul identic nu rescrie strofele.
- Duplicarea atomică a unui program, fără copierea linkurilor publice sau propunerilor.
- Șabloane separate de programele curente; orice program poate fi păstrat ca model.
- Responsabil / echipă pentru fiecare element, vizibil și în programul public.
- Prezentarea întregului program: cântări, strofe și texte, navigare din tastatură și revenire în program. Rezervele sunt excluse implicit; pentru includere folosește `.../present?backup=1`.
- Acces rapid la următorul program, stări de încărcare/eroare și corectarea revenirii la login pentru conturile inactive.
- Dependențe fixate, teste automate și SQL-uri separate pentru actualizare / instalare nouă.

## Actualizarea aplicației existente

1. Salvează o copie a folderului aplicației și un backup al bazei de date.
2. Extrage acest pachet peste sursele aplicației. Păstrează fișierele tale `.env.local` și `.env.worker`; pachetul nu conține chei. Nu copia sau modifica proiectele altor aplicații.
3. În Supabase → SQL Editor, rulează **UPDATE-V42.sql** din rădăcina pachetului. Este pentru instalări cu migrările anterioare, până la 034, aplicate. Include varianta corectată a bibliotecii biblice și migrarea 036. Dacă 035 corectat este deja aplicat, poate fi repetat.
4. Deschide PowerShell în folderul care conține `package.json` și rulează:

```powershell
npm ci
npm test
npm run build
```

5. Pentru utilizare locală:

```powershell
npm run dev
```

Pentru producție: publică sursele prin fluxul de găzduire existent. Nu s-a făcut publicare automată din acest pachet.

### Activarea sincronizării persistente

Aplicația web pune cererea în coadă. **Pentru procesarea ei trebuie să ruleze workerul separat**, pe un calculator/server pornit. Închiderea paginii nu oprește workerul; închiderea terminalului lui îl oprește. La repornire reia de la ultimul element salvat, după expirarea blocării de maximum 90 de secunde.

1. Copiază `.env.worker.example` în `.env.worker` și completează URL-ul aceluiași proiect Supabase și cheia privată `service_role`. Nu publica acest fișier și nu pune cheia într-o variabilă cu prefix `NEXT_PUBLIC`.
2. Într-un al doilea PowerShell, în același folder:

```powershell
npm run worker:build
npm run worker
```

Lasă acest terminal deschis. Pentru producție, rulează comanda ca serviciu cu repornire automată pe un server care permite procese persistente. Găzduirea exclusiv serverless a aplicației web nu pornește automat acest proces.

Pentru o singură unitate de lucru (o pagină sau o cântare):

```powershell
npm run worker -- --once
```

Cererile sunt secvențiale, cu pauză între unități și limită de timp pentru fiecare accesare. O eroare la o cântare este înregistrată separat și nu oprește restul lotului. O eroare la scanarea listei oprește rularea cu mesaj explicit. Poți porni o nouă rulare după rezolvarea cauzei.

Pentru resetări complete sau curățarea importurilor externe, oprește mai întâi workerul și anulează rulările active, apoi efectuează operațiunea administrativă.

### Verificare după instalare

- Login admin și utilizator doar pentru citire; un cont inactiv trebuie să primească mesajul de acces indisponibil.
- Bibliotecă: filtre, sortare, paginile următoare și resetarea filtrelor.
- Program: responsabil, păstrare ca șablon și creare copie pentru o dată nouă.
- Prezentare: săgeți / PageUp / PageDown, ESC și mărimea textului.
- Sincronizare: lot mic, progres, anulare, oprirea și repornirea workerului.
- Link public: vizualizare și propunere externă; dezactivarea linkului trebuie să retragă accesul.

## Instalare nouă

**Nu rula INSTALL-NEW.sql pe o bază SongApp existentă.**

1. Creează un proiect Supabase și rulează `INSTALL-NEW.sql`.
2. Creează utilizatorul în Supabase Authentication.
3. În `supabase/003_make_first_admin.sql`, înlocuiește adresa de email cu cea a utilizatorului creat, apoi rulează fișierul.
4. Copiază `.env.example` în `.env.local` și completează variabilele publice.
5. Rulează `npm ci`, `npm test`, `npm run dev`. Workerul se configurează separat, ca mai sus.

Datele demonstrative și Biblia integrală nu sunt incluse în SQL-ul de instalare. Pentru importul Bibliei, vezi `docs/full-bible-library.md`. Versiunea istorică 035 cu expresia generată incompatibilă este păstrată doar în `supabase/legacy/`.

## Dezvoltare și verificări

```powershell
npm run typecheck
npm test
npm run build
npm run sql:package
```

Testele folosesc PostgreSQL local prin PGlite, fără cheile sau datele tale. Acoperă migrările, accesul direct și prin RPC, paginarea unei biblioteci de peste 5.000 de cântări, copierea programelor, coada și reluarea lucrului, anularea și prezentarea. Nu înlocuiesc proba cu proiectul Supabase real și cu paginile actuale ale sursei externe.

Păstrează modificările SQL viitoare în migrări noi, cu permisiuni explicite. Nu utiliza `INSTALL-NEW.sql` pentru actualizări. Nu există comandă `next lint` în acest pachet; verificările disponibile sunt cele de mai sus.
