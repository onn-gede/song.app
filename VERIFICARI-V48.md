# Verificări v48 / 0.6.0

## Execuție locală de verificare

- `npm test`: 45 teste trecute, zero eșecuri. Migrarea de actualizare și instalarea de la zero au fost executate în PostgreSQL PGlite, inclusiv rerulare.
- Build de producție Netlify cu variabile fictive: trecut, compilare și verificare TypeScript incluse. Nu s-au folosit credențiale reale.
- `npm ci --dry-run --ignore-scripts --no-audit --no-fund`: trecut; testul de regresie verifică și corespondența versiunilor din lockfile cu arhivele. Instalarea curată completă a aceluiași set de dependențe a fost verificată la v47.1.
- `npm run typecheck`: trecut și separat după build.
- Cheia privată fictivă nu apare în fișierele `.next/static` pentru browser.

## Acces și jurnal

Testele de bază verifică: cont nou inactiv, imposibilitatea aprobării de către viewer, promovarea unui al doilea admin, protecția ultimului admin activ, blocarea utilizatorului inactiv, auditarea tranzacțională a modificărilor, autorul obținut din sesiune și imposibilitatea scrierii/ștergerii directe a jurnalului de către utilizatori. Versurile și credențialele nu sunt copiate în jurnal.

Partajările anonime sunt verificate separat: link valid, invalid și dezactivat, acces numai la programul partajat, propuneri și căutare publică blocate implicit și permise numai după activare explicită.

## Interfață

Verificare în Chromium pe build de producție, cu Supabase simulat pentru date și sesiuni:

- Desktop 1440×900 și 1366×768: meniul încape fără scroll propriu; programul are rânduri compacte.
- Mobil 390×844: pregătire și pagină publică fără depășire orizontală.
- Două adăugări consecutive se afișează imediat în program.
- Creare cont în așteptare, aprobare și actualizarea listei fără refresh manual.
- Viewer redirecționat din administrare; vizitator fără cont redirecționat din bibliotecă la login.
- Link public accesibil fără cont; panourile de propuneri lipsesc când opțiunea este dezactivată.
- Nu apar erori JavaScript în aceste scenarii.

Aceste verificări nu substituie verificarea pe proiectul Supabase/Netlify real după configurare. Nu s-a accesat și nu s-a modificat baza utilizatorului.

## Mentenanță și deploy

- TOML Netlify și YAML GitHub Actions: parsate fără erori.
- Scriptul health: trei cereri către RPC-ul minimal; actualizează heartbeat la prima rulare și după circa 48h, fără modificare la rularea intermediară.
- Git repository temporar: un commit numai heartbeat este ignorat de Netlify; modificările de cod permit build-ul.
- Preflight: refuză configurarea fără variabile obligatorii.

Publicarea și programarea externă NU au fost activate în această sesiune. Conexiunea GitHub disponibilă are numai citire; proiectul Netlify nu este conectat. Pașii și variabilele necesare sunt în NETLIFY-SETUP.md. Workflow-ul nu poate reactiva un proiect deja suspendat și nu garantează evitarea limitelor unui plan gratuit.
