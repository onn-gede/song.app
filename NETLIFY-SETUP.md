# SongApp BCBgiroc pe Netlify

## Ce este pregătit și ce trebuie activat în conturile tale

Pachetul include configurarea Netlify, accesul privat, administrarea conturilor,
jurnalul și workflow-ul de mentenanță. Publicarea nu a fost executată din această
sesiune: conexiunea GitHub disponibilă are doar citire pentru `onn-gede/song.app`,
iar contul/proiectul Netlify nu este conectat aici.

Nu trimite parole sau cheia service-role în conversație. Introdu-le direct în
setările private ale proiectului Netlify.

## 1. Actualizează aceeași bază Supabase

Oprește versiunea veche. Rulează **UPDATE-V49.sql** în SQL Editor, pe proiectul
existent care are deja v48. Datele, conturile existente și programele rămân.
Conturile noi devin inactive până la aprobare; conturile existente nu sunt dezactivate.

Dacă nu ai niciun administrator activ, creează contul inițial în Supabase Auth și
folosește `BOOTSTRAP-ADMIN.sql`, completând emailul lui. Dacă ai deja admin,
acest pas nu este necesar. După aceea administratorii se gestionează din aplicație.

În setările Supabase Auth dezactivează înregistrarea publică a utilizatorilor
noi (Allow new users to sign up). Administratorii continuă să poată crea conturi
prin API-ul administrativ al aplicației.

## 2. Pune sursele actualizate în repository

Încarcă sursele v49 în `onn-gede/song.app` sau repository-ul ales pentru Netlify.
Include `netlify.toml`, `.nvmrc`, `.github/workflows`, `scripts` și `ops`.
Fișierele reale `.env.local` / `.env.worker` și directoarele node_modules / .next
nu se încarcă. Exemplele `.env.example` pot rămâne.

Poți folosi GitHub Desktop pentru commit și push. Repo-ul conține și un workflow
Validate SongApp care verifică instalarea, testele și build-ul la modificări.

## 3. Leagă proiectul Netlify

În Netlify, pentru proiect nou: Add new project → Import an existing project →
GitHub → alege repository-ul și branch-ul de producție (de regulă main).
Pentru proiect existent, verifică repository-ul în Project configuration.

Setările sunt preluate din `netlify.toml`:

| Setare | Valoare |
|---|---|
| Framework | Next.js, detectat automat |
| Node | 22 |
| Build command | npm run build:netlify |
| Publish directory | .next |
| Base directory | rădăcina repository-ului |

Nu folosi o regulă SPA `/* /index.html 200`. Runtime-ul Next.js este instalat de
Netlify; nu este necesar un plugin cu versiune aleasă manual.

## 4. Variabile Netlify

În Environment variables adaugă valorile din proiectul Supabase existent.
Folosește contextul Production și scope-urile Builds + Functions; cheia privată
nu trebuie pusă la dispoziția unor Deploy Previews din contribuții neîncredere.

| Variabilă | Conținut |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | URL-ul proiectului Supabase existent |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | cheia anon / publishable a aceluiași proiect |
| SUPABASE_SERVICE_ROLE_KEY | cheia privată service_role / secret, numai pe server |
| NEXT_PUBLIC_SITE_URL | URL-ul HTTPS al proiectului, de exemplu https://songapp-bcbgiroc.netlify.app |

Preflight-ul oprește build-ul dacă lipsesc variabilele sau URL-ul public indică
localhost. Nu afișează valorile private în loguri. Schimbarea variabilelor cere
un deploy nou.

În Supabase Auth → URL configuration pune URL-ul HTTPS Netlify ca Site URL.
Aplicația folosește email + parolă, fără înregistrare publică în interfață.

## 5. Acces public la infrastructură, autentificare în aplicație

În Project configuration → General → Visitor access → Project visibility setează
producția **Public**, sau folosește Make public. Previews pot rămâne Private.
Această setare permite cererilor să ajungă la SongApp. Biblioteca și administrarea
rămân protejate prin autentificarea SongApp; numai linkurile de program active se
citesc fără cont. Dacă Netlify cere login la app.netlify.com/edge-access sau răspunde
401 înaintea paginii aplicației, verifică această setare. Ea nu poate fi corectată
printr-un fișier din repository.

Documentație: https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/

## 6. Deploy și verificare

Declanșează deploy-ul din Netlify. Verifică:

1. Fără cont, `/songs` și `/meetings` duc la login.
2. Adminul existent se poate autentifica.
3. În Utilizatori poate crea un cont, care apare în așteptare.
4. Contul nou nu primește acces înainte de aprobare.
5. Se pot activa mai mulți administratori; ultimul admin activ nu poate fi dezactivat.
6. În Activitate apar accesări, autentificări și modificări.
7. Un program cu link public activ se poate deschide într-o fereastră privată, fără cont.
8. Propunerile externe sunt permise numai dacă proprietarul activează opțiunea în partajare.

La upload online există limita platformei pentru corpul cererii. Interfața
limitează fișierele la **4 MB în total per lot** pe Netlify. Pentru arhive mari,
împarte importul în loturi mai mici sau folosește aplicația locală.

## 7. Mentenanță și fișier actualizat la două zile

În GitHub → repository → Settings → Secrets and variables → Actions:

- Variable `SUPABASE_URL`: URL-ul proiectului Supabase.
- Secret `SUPABASE_ANON_KEY`: cheia anon/publishable (nu cheia service_role).
- Permite workflow-ului să scrie în repository pentru commit-ul heartbeat.

În Actions rulează manual o dată **Database health and heartbeat**. Apoi rulează
zilnic la aproximativ 06:15 UTC. Face trei verificări mici ale bazei și actualizează
`ops/heartbeat.json` doar după aproximativ 48 de ore. Fișierul nu este folosit de
aplicație. Commit-urile au skip CI / skip Netlify, iar regula ignore din Netlify
oprește build-urile care schimbă numai acel fișier.

Nu există un job activ până când workflow-ul este pe branch-ul implicit,
variabilele sunt configurate și GitHub Actions are permisiunile necesare.
Un branch protejat sau oprirea programărilor de către GitHub poate cere o
reactivare manuală; verifică din când în când istoricul jobului.

Distincția între servicii:

- Supabase Free poate fi suspendat după activitate redusă într-un interval de 7 zile. Verificările zilnice generează interogări reale, fără a citi biblioteca. Nu reprezintă o garanție împotriva politicii de pauză.
- Netlify Free poate pune proiectele pe pauză la atingerea cotelor/creditelor. Un fișier modificat nu reînnoiește cota. Workflow-ul evită deploy-urile repetitive care ar consuma-o.
- Dacă un proiect este deja pe pauză, trebuie reluat din dashboard; acest workflow nu îl poate reactiva automat.

## Jurnalul

Modificările tabelelor aplicației sunt înregistrate în aceeași tranzacție cu
schimbarea: autor, dată, resursă, câmpuri schimbate și valori utile precum titlu,
rol, stare și poziție. Nu se copiază parole, chei, tokenuri, versuri sau note integrale.
Accesările prin aplicație sunt înregistrate pe server; printul inclusiv Ctrl+P
este raportat de browser. Prefetch-urile și verificările Live nu umplu jurnalul.
Încercările de autentificare eșuate sunt înregistrate prin cheia privată de server.

Doar administratorii citesc jurnalul. Utilizatorii aplicației nu pot falsifica,
modifica sau șterge rândurile direct. Administratorul infrastructurii Supabase
rămâne administrator al bazei; acest jurnal nu înlocuiește auditul infrastructurii.
Dacă baza/jurnalul nu este disponibil, accesul privat este oprit; pagina de login
și partajările validate rămân separate. Printul depinde de suportul evenimentului
browserului și de rețea. Evenimentele anonime nu identifică o persoană fără cont.

## Documentație oficială

- [Netlify: configurarea Next.js](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Netlify: proiecte pe pauză și cote](https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/)
- [Netlify: ignorarea build-urilor](https://docs.netlify.com/build/configure-builds/ignore-builds/)
- [Supabase: pauza proiectelor Free](https://supabase.com/docs/guides/platform/free-project-pausing)
