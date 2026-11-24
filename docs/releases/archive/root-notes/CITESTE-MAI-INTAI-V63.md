# SongApp v63 / 0.9.1 — istoric actualizat și categorii multiple

1. Oprește aplicația cu Ctrl+C. Extrage fișierele peste D:\Apps\song.app, lângă package.json. Păstrează .env.local, .git și local-assets.
2. În ACELAȘI proiect Supabase, rulează supabase/updates/UPDATE-V63.sql. Dacă nu ai rulat încă UPDATE-V62.sql, rulează-l întâi (ambele sunt în arhivă).
3. Rulează pe rând în PowerShell:

    Set-Location "D:\Apps\song.app"
    npm ci
    npm run build

Doar dacă buildul reușește:

    npm run local

## Reguli

- Eliminarea din program retrage acea utilizare din istoric, atât în timpul celor două ore, cât și după finalizare.
- Dacă există utilizări în alte programe, ele rămân și ultima utilizare se recalculează.
- O piesă doar în backup nu se consideră cântată. Mutarea din principal în backup retrage utilizarea, iar mutarea înapoi în principal o restabilește dacă programul a început.
- Dacă aceeași piesă există încă în principal, eliminarea unui duplicat nu retrage întreaga utilizare a programului.
- Calendarul poate afișa separat planificări/rezerve, marcate corespunzător; acestea nu contribuie la cântate recent sau cele mai cântate.
- Orice cântare poate avea mai multe categorii; + Categorie nu le înlocuiește pe cele anterioare. Toate categoriile sunt vizibile în listă.
- Textul Trage a fost eliminat. Mânerul cu iconiță rămâne funcțional.

Patch-ul include modificările v62 și corecțiile locale v61. Nu trebuie reimportate cele 803 PPT/PDF. Nu s-a făcut push sau deploy.
