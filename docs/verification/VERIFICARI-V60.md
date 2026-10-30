# Verificare SongApp — 29.10.2026

Bază verificată: main cd03455b00d329c926622ea0a02c95dcb35e722c, v59.1 / 0.8.2.
Corecție rezultată: v60 / 0.8.3.

## Confirmat

- GitHub Validate SongApp #6 / 40892714886: npm ci, npm test, build și typecheck reușite.
- Rulare locală după corecție: 78 teste trecute (68 TypeScript/DB, 7 import cărți, 3 validare PPT), zero erori. Build de producție reușit.
- Test de browser local, cu Next.js de producție și backend Supabase simulat: căutare deschisă implicit, două adăugări consecutive, resetare căutare, actualizare listă fără refresh; salvare solist/observații și închiderea editorului; marcaj comun imediat; reordonare prin săgeată; transfer în backup și înapoi; echipă actualizată imediat; moment Diverse cu observații; aprobare propunere actualizează lista.
- Print la prima apăsare: document separat A4, o pagină pentru cazul de test, responsabili/solist/tonalitate/observații prezente; meniul aplicației ascuns. PDF randat și inspectat vizual.
- Pagină program și public la 390px: fără overflow orizontal în cazul verificat. Publicul a fost testat local fără cookie de autentificare. Cele 7 tipuri coincid. Fără erori JavaScript.
- Testele bazei rulează într-un PostgreSQL local de test (PGlite), nu în baza live; acoperă surse/numere, persistență, drepturi, propuneri, deduplicare, fișiere incomplete și 803 identități PPT.
- Live: pagina principală trimite la /login, cu formularul de autentificare, deci accesul intern este protejat.

## Corectat

Printul și prezentarea ignorau moment_kind. Diverse putea apărea Poezie/Text, iar un moment Cântare fără piesă din bibliotecă putea apărea Moment. Folosesc acum tipul ales efectiv; ruta de prezentare citește și moment_kind. Adăugat test de regresie pentru Diverse/Cântare/Poezie și păstrarea observațiilor.

## Neconfirmat / limitări

- Cele două linkuri vechi /program/joi-28-10-f17978 și /program/duminica-dimineata-1-11-13ec76 întorc 404 în browserul live fără autentificare. Nu cer autentificare: este 404, nu redirect la login. Pot fi dezactivate/șterse/expirate. Fără acces la baza live nu pot stabili cauza. Nu am schimbat accesul lor.
- Powered by Netlify rămâne vizibil pe login/live. Necesită dezactivare din setările Netlify.
- Ultima rulare health disponibilă în GitHub este cea veche eșuată, 40877076836; nu am găsit o rulare nouă reușită după patch. Nu am relansat automat nimic.
- Catalogul conține 803 numere, dar existența celor 803 perechi PPT/PDF în Supabase Storage live nu poate fi certificată fără acces la cont/bază. VERIFY-803-ONLINE.sql face verificarea prin SELECT; nu modifică date.
- Programul complet de prezentare rămâne bazat pe versuri; PPT/PDF se deschid individual. Nu s-a implementat un deck combinat din PPT-uri.
- Testele locale cu backend simulat verifică UI și cererile, nu latența reală a Supabase/Netlify. Nu au fost trimise propuneri sau create programe de test pe live.

Nu s-a făcut push, deploy sau modificare în baza de producție.
