# SongApp BCBgiroc · v58 / 0.8.0 · lucru local

**Validăm local. Urcăm în Git și publicăm numai după ce decidem că versiunea este pregătită.**

## Pornire

1. Extrage arhiva într-un folder nou: `D:\Apps\SongApp-local`. Astfel nu rămân fișierele vechi mutate din rădăcină.
2. Copiază `.env.local` din vechea aplicație în acest folder. Păstrează vechiul folder ca rezervă.
3. În `.env.local`, setează `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Restul valorilor Supabase rămân aceleași.
4. Rulează comenzile pe rând, continuând numai după succes:

```powershell
Set-Location "D:\Apps\SongApp-local"
npm ci
npm run build
npm run local
```

Deschide **http://localhost:3000**. Ulterior: `npm run local` sau dublu click pe `PORNESTE-APLICATIA.cmd`. Oprire: Ctrl+C.

Prima pornire compilează aplicația pe laptop. Următoarele porniri refolosesc build-ul dacă sursele nu s-au schimbat. Nu este necesar un repository Git pentru rularea locală.

Aplicația folosește aceeași bază Supabase online și aceleași conturi. Schimbările datelor se văd și în aplicația găzduită. Rularea locală nu este un mod offline.

**Pentru v58 rulează `supabase/updates/UPDATE-V58.sql` în aceeași bază, după v57/v57.1.** Apoi `npm run import:black-book` încarcă cele 803 titluri, originalele PPT și previzualizările. [Instrucțiuni complete](docs/guides/IMPORT-PPT-V58.md) · [Catalogul titlurilor](docs/catalogs/CARTEA-NEAGRA-PPT.md).





## Structura proiectului

| Folder / fișier | Conținut |
|---|---|
| `app/` | pagini, API și acțiuni Next.js |
| `components/` | interfața aplicației |
| `lib/` | logică comună și conexiunea Supabase |
| `public/`, `types/` | resurse statice și tipuri |
| `supabase/migrations/` | SQL sursă, în ordine |
| `supabase/updates/` | pachete de actualizare pentru baze existente |
| `supabase/setup/` | instalare pe bază goală și primul administrator |
| `supabase/legacy/` | SQL istoric, păstrat pentru referință |
| `docs/guides/` | ghiduri de lucru local și import |
| `docs/verification/` | verificările fiecărei versiuni |
| `docs/history/`, `docs/design/` | istoric și design |
| `docs/deployment/` | configurarea Netlify, pentru mai târziu |
| `scripts/` | pornire și utilitare |
| `scripts/windows/legacy/` | depanare Windows istorică |
| `tests/` | teste automate |
| `samples/` | exemple de import |
| `ops/` | fișierul de mentenanță |
| `PORNESTE-APLICATIA.cmd` | pornire locală prin dublu click |

În rădăcină rămân numai ghidul, pornirea și fișierele tehnice cerute de Next.js/npm. `.env.local`, `node_modules`, `.next`, `dist-worker` și `.git` nu sunt incluse în arhivă.

## Noutăți v56

- /songs: linkuri cu numerele paginilor, prima/ultima pagină, câmp Numărul paginii + Mergi. Filtrele și ordonarea se păstrează. O pagină care depășește totalul este redirecționată la ultima pagină validă.
- Ordonări rapide vizibile: Adăugate recent; Cântate recent în programe; Cele mai des cântate. Cele bazate pe utilizare includ numai cântări cu utilizări în programe începute, fără backup, șabloane sau date viitoare, cu o singură utilizare per program.
- Colecții: numărătoare SQL distinctă a cântărilor active, aceeași regulă ca în /songs; nu se mai descarcă o listă trunchiată de song_sources pentru numărare.
- Activitate: implicit doar modificări, cu numele resursei, acțiunea și câmpurile afectate. Valori înainte/după unde sunt păstrate în siguranță; codurile sunt în Detalii tehnice. Noile evenimente păstrează denumirea și pentru elemente șterse.
- Jurnalul rămâne accesibil numai administratorilor. Fără push sau deploy.

## Import Carte roșie · v55 păstrat

1. Oprește aplicația și păstrează .env.local la înlocuirea fișierelor.
2. Rulează supabase/updates/UPDATE-V55.sql în SQL Editor, pe același proiect cu v54.
3. Rulează npm ci, apoi npm run import:red-book sau dublu click pe IMPORT-CARTEA-ROSIE.cmd.
4. Dacă SUPABASE_SERVICE_ROLE_KEY este deja configurată local, se folosește automat. Altfel introdu în consolă contul SongApp cu drept de editare; parola nu este afișată, logată sau salvată.
5. La final rulează npm run build, npm run local și deschide colecția.

Verificarea sursei a găsit 1.200 de înregistrări: 601 numerotate și 599 variante care corespund pieselor numerotate. Cele 599 se leagă de aceleași cântări, nu creează cântări noi. 571 texte vin din API și 30 au fost recuperate din PPT. Importatorul recitește sursa la prima rulare pe calculatorul tău; cache-ul nu este inclus în arhivă.

Importul reutilizează piesele cu o corespondență clară și păstrează versurile, tonalitățile, observațiile și structurile existente. Completează doar versuri goale și adaugă legătura/numărul în colecție dacă lipsesc. Conflictele de titlu/număr sunt lăsate pentru verificare. Nu se șterg sau unifică automat piese existente.

Poți relua aceeași comandă fără dubluri. Raportul cu nume distinct este în .songapp-imports/red-book/raport-*.json. Acesta arată created, linked, filled, existing, review și erorile. Cache-ul și raportul sunt excluse din Git. Pentru recitirea catalogului: npm run import:red-book -- --refresh. Pentru testarea sursei fără acces la baza ta: node scripts/import-red-book.mjs --prepare-only.

Detalii: [Import Carte roșie](docs/guides/IMPORT-CARTEA-ROSIE.md).

## Noutăți v54 păstrate

- Taguri centrate, cu aceeași înălțime și borduri neutre. Tagul colecției are fundal în culoarea colecției și text ales pentru contrast; marcajul în comun rămâne roșu.
- Cântare în comun: feedback imediat, cerere separată de salvare și confirmarea snapshot-ului într-un singur apel SQL; eroarea revine la starea confirmată și afișează mesaj.
- Aprobarea propunerilor folosește ordonarea actuală, fără conflicte între program și backup. Repetarea aceleiași aprobări nu dublează elementul.
- Buton Notificări lângă Vezi public, cu număr roșu pentru propuneri în așteptare. Secțiunea se deschide din buton, iar acceptarea/respingerea actualizează imediat lista și programul. Verificare automată la 15 secunde cât pagina de editare este vizibilă.
- Pagina publică păstrează aranjarea actuală. Modificările afișează banner vizibil până la Am văzut, semnal în titlul tabului și notificare de sistem cu permisiune. Verifică și cu fereastra minimizată; sunet opțional activat prin buton.
- Pentru notificările sistemului: apasă Activează notificările în pagina publică și permite notificările în browser/Windows. Browserul poate întârzia verificările în fundal. Nu sunt notificări push cu browserul închis.
- Validare locală, fără push sau deploy.

## Noutăți v53 păstrate

- Colecții/categorii: salvare cu blocarea dublului click, erori vizibile și reîncărcarea interfeței; numele și culoarea se văd imediat.
- Căutarea pentru adăugarea cântărilor este deschisă și la programele existente.
- După tonalitate/număr/colecție apare „Cântare comun”. Activarea afișează „Cântare în comun” pe roșu; un nou click elimină marcajul.
- Marcajul rămâne după redeschidere, la duplicare, în pagina publică și la print și este înregistrat în jurnal.
- Taguri cu text normal și fundal alb; culoare doar pe bordură, cu excepția marcajului roșu.
- Momente: titlu + observații vizibile direct, fără solist sau secțiune „Textul momentului”. Observațiile vechi sunt păstrate.
- Doar lucru local; fără push sau deploy.

## Noutăți v52 păstrate

- Colecții cu culori persistente, configurabile din pagina Colecții. Titlul, numărul, etichetele și linia de lângă drag indică aceeași colecție.
- Pentru o piesă cu mai multe surse alegi colecția de referință la adăugare sau în editorul piesei; numărul este cel exact din sursa aleasă.
- Echipa și data/ora sunt mai vizibile. Editarea solistului/observațiilor se deschide lângă text. Adaugă moment este sus, lângă Adaugă cântări.
- Căutarea avertizează despre programe viitoare, în curs și utilizări trecute. Calendar și istoric arată cercuri roșii și orele programelor, fără a include programul curent sau șabloanele.
- Programul este În pregătire înainte de început, În curs de la început până la două ore, apoi Finalizat. Etichetele și listele se actualizează automat pe pagina deschisă; șabloanele și arhivarea rămân distincte.
- Toate fluxurile sunt adaptate și pentru mobil.

## Comenzi locale

- `npm run local`: modul optimizat pentru folosire și verificări, cu consum mai mic în repaus.
- `npm run dev`: editare cu recompilare automată; poate solicita mai mult procesorul.
- `npm test`: teste cu bază temporară PGlite, fără datele tale reale.
- `npm run typecheck`: verificare TypeScript după build.
- `npm run sql:package`: regenerează fișierele în supabase/setup și supabase/updates; nu execută SQL pe baza reală.

Detalii: [Program și colecții v52](docs/guides/PROGRAM-V52.md), [Lucru local](docs/guides/LUCRU-LOCAL.md) și [Verificări v52](docs/verification/VERIFICARI-V52.md).

## Git și publicare

Nu există niciun pas de push sau deploy în pornirea locală. Putem face commit-uri locale când folosim Git; ele rămân pe laptop până la push.

Netlify și workflow-urile existente sunt păstrate pentru reluarea publicării mai târziu. Setările contului Netlify nu sunt modificate de această arhivă. Nu trebuie să le găsești sau să le schimbi pentru a valida pe laptop.
