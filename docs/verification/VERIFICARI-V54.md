# Verificări v54 / 0.7.2 · local

## Cerințe

- Taguri centrate pe ambele axe, aceeași înălțime, spațiere uniformă, borduri neutre. Colecția păstrează culoarea pe fundal; textul se adaptează pentru contrast. Cântare în comun rămâne roșu. Pe mobil se permite împărțirea pe rânduri.
- Cântare în comun se actualizează vizual imediat și salvează prin API privat, cu un singur RPC pentru validare, modificare și snapshot. Eroarea revine la starea confirmată. Fără randarea întregii pagini în răspunsul salvării.
- Aprobarea propunerilor folosește lock per program și ordonarea globală actuală, inclusiv backup. Repetarea aceleiași cereri nu dublează elementul. Erorile apar în secțiune și păstrează propunerea disponibilă.
- Notificări lângă Vezi public, contor roșu pentru propuneri în așteptare, secțiune cu acceptare/respingere și verificare automată la 15 secunde în pagina vizibilă.
- Pagina publică păstrează aranjarea existentă. Banner vizibil până la Am văzut, titlu de tab cu avertizare păstrat peste refresh, notificare de sistem cu permisiune și requireInteraction, verificare și în fundal, sunet opțional.

## Verificări

- 57 teste trecute, zero eșecuri.
- Testul PostgreSQL reproduce eroarea 23505 a funcției vechi de aprobare când programul principal și backup folosesc poziții consecutive. Același scenariu trece după UPDATE-V54.
- Aprobare la început, aprobare în backup, observații păstrate, respingere, retrimitere fără duplicare, contor pending și snapshot actualizate.
- RPC-ul rapid verifică programul și piesa, avansează revizia, respinge viewer/cont inactiv/anonim. Reviziile monotone existente sunt păstrate.
- UPDATE-V54 rerulat și instalare nouă completă verificate cu PGlite. Migrarea nu creează tabele noi și nu șterge date.
- Worker notificări: clickul reutilizează tabul programului; respinge URL-uri externe și alte pagini private.
- Build optimizat și TypeScript trecute.
- Chromium pe build de producție, cu Supabase simulat: feedback imediat sub 700 ms când salvarea este întârziată intenționat 1,5 secunde; marcaj păstrat după redeschidere; revenire după eroare și reîncercare reușită.
- Propunere nouă primită prin polling: contorul devine 2; aprobare eșuată păstrează lista și arată eroare; reîncercare și respingere reduc numărul la 0 și actualizează programul, fără pageerror.
- Stiluri calculate ale tagurilor și verificări de încadrare la 390/320 px; capturi inspectate pentru program, notificări și banner public.
- Pagina publică simulată ca ascunsă: se verifică modificarea și se apelează afișarea notificării cu requireInteraction=true; bannerul și titlul rămân după refresh, Am văzut le elimină. API-ul de notificări a fost simulat în browser; afișarea efectivă în Windows depinde de permisiunile și setările sistemului.
- Nu au fost folosite credențiale sau baze reale. Fără push/deploy.

## Instalare

Oprește procesul local, înlocuiește fișierele și păstrează .env.local. Pe aceeași bază cu v53 rulează supabase/updates/UPDATE-V54.sql. Apoi npm ci, npm run build, npm run local. Nu rula INSTALL-NEW pe baza existentă.

Notificările de sistem se activează prin click în pagina publică. Browserul poate limita temporizatoarele în fundal; nu există abonament push pentru browserul complet închis.
