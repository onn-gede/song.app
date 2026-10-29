# Verificări v51 / 0.6.3 · arhivă pentru lucru local

- Reorganizare pornind de la pachetul v50 / 0.6.2. Toate cele 171 fișiere de aplicație și SQL comparate au conținut identic cu versiunea sursă, inclusiv pachetele regenerate. Nu există migrare SQL nouă.
- Migrările SQL sunt în supabase/migrations, pachetele de actualizare în supabase/updates, instalarea și bootstrap-ul în supabase/setup. Testele și generatorul SQL folosesc noile căi.
- `npm run sql:package`: trecut, fără conectare la baza utilizatorului.
- `npm test`: 49 teste trecute, zero eșecuri, inclusiv actualizările și instalarea de la zero în baza temporară PGlite.
- `npm ci --dry-run --ignore-scripts --no-audit --no-fund`: trecut. Dependențele nu s-au schimbat; numai versiunea proiectului a devenit 0.6.3.
- `npm run typecheck`: trecut separat după build.
- `npm run local`: a compilat versiunea optimizată cu valori Supabase fictive, a verificat TypeScript și a pornit serverul local. A doua pornire a refolosit build-ul.
- Starterul folosește explicit 127.0.0.1 pentru serverul local. Acest lucru evită enumerarea interfețelor de rețea indisponibilă în mediul de verificare. În browser se folosește http://localhost:3000.
- Verificare HTTP locală: /login răspunde 200, iar /meetings fără sesiune redirecționează la login.
- Nu s-au accesat date sau credențiale Supabase reale. Nu s-au făcut commit, push sau deploy și nu s-au modificat setări Netlify.

## Aplicare

Extrage într-un folder nou, de exemplu D:\Apps\SongApp-local. Copiază .env.local din versiunea existentă și setează NEXT_PUBLIC_SITE_URL=http://localhost:3000. Rulează npm ci, apoi npm run local.

Baza Supabase rămâne aceeași. Modificările de date sunt comune aplicației locale și celei online. Nu rula INSTALL-NEW.sql pe baza existentă.

Nu sunt incluse .git, node_modules, .next, dist-worker sau fișiere reale .env. Versiunile anterioare ale arhivelor rămân separate. Configurația Netlify este păstrată exclusiv pentru reluarea publicării după validarea locală.
