# SongApp — verificare inițială de securitate și calitate

Data: 30.10.2026. Sursă locală v71 actualizată la v72 / 0.12.1. Fără acces la configurația reală Supabase, fără test de penetrare pe live. Rezultatele nu reprezintă o certificare de securitate sau o confirmare că proiectul nu a fost compromis.

## 1. Dependențe: remediat local

Audit inițial npm: 6 pachete raportate (1 critical, 4 high, 1 moderate). Un pachet poate avea mai multe advisories. Raportarea nu demonstrează că toate atacurile sunt aplicabile în configurația SongApp.

| Pachet | Versiune finală |
|---|---|
| Next.js | 16.4.3 |
| sharp | 0.35.5 |
| postcss | 8.5.23 |
| nanoid | 3.3.20 |
| baseline-browser-mapping | 2.11.34 |
| source-map-js | 1.2.2 |

Audit final npm: 0 info, 0 low, 0 moderate, 0 high, 0 critical. Dependențele au fost actualizate controlat; nu s-a folosit audit fix --force. package-lock.json este inclus. Vulnerabilități noi pot apărea ulterior; rezultatul este valabil pentru baza de advisories consultată la verificare.

Next.js avea advisories pentru bypass de proxy, indisponibilitate prin Server Actions, SSRF și execuție de cod în anumite funcționalități/configurații. Unele depind de Windows, use cache sau image optimization; nu am demonstrat exploatarea acestor condiții în aplicație. Actualizarea înlocuiește totuși versiunea afectată.

Surse primare:
- https://github.com/advisories/GHSA-p3m5-59mp-jv5r
- https://github.com/advisories/GHSA-2464-fhr4-w9xw
- https://github.com/advisories/GHSA-673q-mjm6-r5xr

## 2. Întăriri aplicate

- X-Frame-Options SAMEORIGIN și CSP frame-ancestors self: împiedică încorporarea aplicației într-un site extern. Încorporarea proprie rămâne permisă.
- CSP base-uri self, nosniff, Referrer-Policy și Permissions-Policy setate și în Next, inclusiv la rulare locală/cPanel. CSP-ul este intenționat parțial: nu filtrează încă toate scripturile/conexiunile. Nu îl confundăm cu protecție XSS completă.
- Eliminat antetul X-Powered-By.
- Redirectul către URL-ul semnat de descărcare primește private, no-store (anterior doar răspunsurile de eroare îl aveau). Durata URL-ului semnat rămâne 120 secunde.
- Loginul respinge emailuri peste 320 de caractere și parole peste 1024 înainte de apelul extern. Nu este o limitare a numărului de încercări.
- Workflow-ul existent de validare execută npm audit --audit-level=moderate. Nu există workflow periodic nou, builduri Netlify suplimentare programate sau actualizări automate publicate.

## 3. Protecții existente găsite în zonele inspectate

- requireProfile verifică identitatea pe server, cont activ și rol. Modificările de conturi solicită admin; cheia service role este într-un modul server-only.
- Migrarea v65 are politici restrictive admin pentru scrierea în profiles. Efectul real depinde de aplicarea migrărilor pe proiectul live.
- Importul de linkuri verifică protocol/adresă publică, blochează rețele private și fixează rezultatul DNS pe conexiune; are limită de timp și dimensiune/decompresie.
- Backupul validează căile ZIP, dimensiunile declarate și SHA-256 pentru conținut. Restaurarea are verificări admin, preview și ticket în SQL. Acestea nu înlocuiesc backupurile păstrate separat și testele periodice de restaurare.
- Nu am găsit dangerouslySetInnerHTML în căutarea țintită din app/components/lib. Aceasta nu constituie un audit complet pentru XSS al fiecărui flux sau fișier încărcat.

## 4. Validare efectuată

- npm audit: 0 vulnerabilități cunoscute.
- npm test: 95 trecute (83 TypeScript/DB, 7 import carte roșie, 3 PPT, 2 build local).
- Build de producție Webpack pe Linux: trecut, inclusiv TypeScript. Windows real și runtime-ul Netlify necesită confirmare după actualizare.
- Browser Chromium cu backend de test: pagina publică/PWA, iconițe, instrucțiuni și flux instalare simulat, responsive, cookie invalid curățat/refresh valid păstrat, antete, refuz acces anonim la admin și API privat. Nicio eroare JavaScript în aceste verificări.
- Nu am testat instalarea pe un iPhone real sau pe un Android real și nu am folosit conturi/date reale.

## 5. Priorități rămase înainte de a declara securitatea verificată pe live

1. Publicarea patchului: serverul live rămâne la versiunea veche până la deploy.
2. Supabase Authentication: confirmă că Allow new users to sign up este dezactivat dacă doar adminii creează conturi; verifică rate limits, politica de parole și protecțiile anti-abuz disponibile pe planul folosit. Nu trimite chei sau parole în conversație.
3. Rulează diagnosticul numai citire VERIFICA-SECURITATE-V72.sql și verificăm politicile reale RLS, funcțiile security definer expuse și bucketurile. Un grant pentru anon nu este automat o breșă: RPC-urile publice sunt intenționate și trebuie analizate individual. Bucketul song-files trebuie evaluat împreună cu fluxurile de link public și politicile storage; nu îl schimbăm orbește.
4. Sugestiile anonime au verificare de link activ/expirare/allow_contributions și aprobare înainte de intrarea în program. În funcția inspectată nu există throttling robust sau limite explicite pe toate textele. Următorul patch ar trebui să introducă limite la nivel DB și protecție anti-spam, cu teste, inclusiv pentru apeluri directe la RPC. Un contor în memoria serverului Netlify nu este suficient pentru mai multe instanțe.
5. Confirmă că logurile nu expun secrete, că utilizatorii inactivi nu pot citi/scrie, că editorii nu pot modifica roluri și că linkurile dezactivate/expirate nu mai funcționează, folosind conturi reale de test.
6. Stabilește retenția jurnalelor și un test de restaurare într-un mediu separat. Backupul de conținut al aplicației nu reconstruiește parolele sau toate setările Supabase.

## 6. Îmbunătățiri de cod recomandate, separat de patchul de securitate

- Împărțirea componentelor mari de program în subcomponente, cu o singură sursă pentru metadate/culori/print; reduce diferențele dintre editare, public și prezentare.
- Înlocuirea treptată a tipurilor any cu tipuri generate din schema Supabase și validare comună pentru intrări/API/RPC; prioritate import și backup.
- Formatarea fișierelor comprimate pe un rând și reguli automate de lint/format pentru modificări noi; ajută revizia permisiunilor și tratarea erorilor.
- Reducerea treptată a limitelor globale de request și stabilirea unor limite separate pentru import, upload și formulare mici; limita actuală de 100 MB susține fluxuri existente și nu a fost redusă fără testarea lor.
- Măsurarea căutării și mutării cu date reale, verificarea indexurilor și a interogărilor, fără încărcare artificială pe producție.
- CSP mai strict cu nonce numai după verificarea PDF, scripturilor Next și conexiunilor Supabase. Nu adăugăm o politică ce blochează fluxurile existente fără teste.

Ordinea propusă: publicare securitate → verificare Supabase/anti-abuz → test pe telefon → refactorizare graduală. Nu este justificată rescrierea întregii aplicații.
