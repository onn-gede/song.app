# SongApp v73 — 0.12.2 — Sugestii publice protejate

Pachet peste v72. Fără push sau deploy. Nu s-a executat SQL pe baza reală.

Modificări:
- Limite verificate în formular, server și RPC: titlu 180, observații 4000, nume 120, notă 1000 caractere. RPC respinge textul prea lung în loc să îl trunchieze.
- Retrimiterea aceleiași propuneri încă în așteptare în 30 secunde returnează propunerea existentă. După această fereastră o nouă propunere identică este permisă.
- Bugete comune per link public: maximum 20 propuneri/minut, 200/oră, 100 în așteptare. Propunerile procesate continuă să conteze în fereastra de timp.
- Blocare tranzacțională pe link pentru a serializa cererile între instanțe. Verificarea linkului activ/expirării se repetă după blocare.
- Mesaje publice controlate, fără erorile interne ale bazei.
- Validarea reutilizabilă este separată în lib/public-contribution.ts.

Aceste limite reduc spamul, dar nu identifică persoana și nu sunt protecție DDoS. Un vizitator abuziv poate consuma bugetul comun; echipa poate opri sugestiile din Partajare. Protecția loginului trebuie verificată în Supabase Authentication; acest pachet nu introduce un contor în memoria Netlify.

## Lucru local
Oprește serverul, extrage peste D:\Apps\song.app, apoi:

```powershell
Set-Location "D:\Apps\song.app"
npm test
if ($LASTEXITCODE -eq 0) { npm run build }
if ($LASTEXITCODE -eq 0) { npm run local }
```

Dependențele sunt aceleași ca în v72. Nu este necesar npm ci dacă v72 este instalat.

## SQL pregătit, neexecutat
supabase/updates/UPDATE-V73.sql aplică protecțiile în baza de date existentă după v67. Pentru instalare nouă, INSTALL-NEW.sql include migrarea. Nu rula INSTALL-NEW.sql pe baza existentă.

ATENȚIE: dacă .env.local indică proiectul Supabase folosit de site-ul public, aplicarea UPDATE-V73.sql acolo schimbă comportamentul și pentru site-ul live, chiar fără deploy. Pentru validare izolată folosește o bază de test. Până aplici migrarea, funcționează validările din formular/server, dar bugetele și deduplicarea nu sunt active în RPC-ul vechi.

Testele automate aplică SQL într-o bază PGlite izolată și nu ating Supabase real. Limitele, deduplicarea, depășirea bugetelor, linkul dezactivat și păstrarea programului nemodificat au fost verificate acolo. Blocarea este definită în SQL; testul local nu simulează un atac distribuit real.

Pasul separat pentru securitatea Supabase: rulează diagnosticul numai citire VERIFICA-SECURITATE-V72.sql din pachetul precedent și trimite rezultatele pentru interpretare. Nu trimite parole sau chei. Acest diagnostic nu aplică migrarea v73.
