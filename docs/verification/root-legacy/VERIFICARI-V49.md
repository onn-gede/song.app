# Verificări v49 / 0.6.1

- 48 teste trecute, zero eșecuri: migrare v49 și rerulare, instalare nouă, permisiuni, păstrarea funcțiilor v48.
- Build de producție și TypeScript trecute cu variabile fictive; nu s-au folosit credențiale reale.
- Cererea repetată cu același identificator și autor întoarce același program. Viewer, cont inactiv și anon nu pot crea. Crearea cu cântare inexistentă se anulează integral.
- Ora 10:15 de iarnă și 18:45 de vară se convertesc corect între Europe/Bucharest și UTC. Datele invalide și ora inexistentă la schimbarea orei sunt refuzate.
- Căutare testată cu peste 5.200 cântări în PGlite: titlu, număr, versuri, fără diacritice, limită de rezultate, drepturi și jurnal. Nu reprezintă un benchmark al latenței pe baza reală.
- Chromium pe build de producție cu Supabase simulat: două trimiteri de formular produc o singură cerere; navigare automată; cele 96 intervale de 15 minute; 10:15 se păstrează inclusiv într-un browser cu fus America/Los_Angeles.
- În browser: anularea căutărilor depășite, rezultate care nu se suprascriu cu răspunsuri vechi, reutilizarea rezultatelor unei căutări repetate, două adăugări consecutive, backup sub lista principală la 1440 și 390px, fără depășire orizontală sau erori JavaScript.
- Link public local fără cont, iar /meetings cere autentificare. Baza reală nu a fost modificată.

## Constatare pe site-ul real

La verificarea din 28 octombrie 2026, ambele adrese /program furnizate au răspuns
HTTP 401 cu Login Redirect către app.netlify.com/edge-access. Este protecția Netlify
anterioară aplicației. Schimbarea Project visibility pentru producție în Public
este necesară în dashboard; nu a fost efectuată din această sesiune.

## Aplicare

Rulează UPDATE-V49.sql pe aceeași bază care are v48, apoi actualizează toate sursele
și publică versiunea 0.6.1. Nu se șterg programele dublate deja create și nu se
modifică automat orele istorice, deoarece alegerea inițială a utilizatorului nu
poate fi dedusă în siguranță. Corectarea se aplică la salvările noi.
