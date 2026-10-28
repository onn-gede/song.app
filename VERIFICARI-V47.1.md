# v47.1 / 0.5.1

- Reprodus exact EUSAGE / Missing @supabase/phoenix@0.4.5 cu lockfile-ul v47.
- Cauza: versiunea din intrarea phoenix fusese schimbată accidental în 0.5.0, deși arhiva și integritatea indicau 0.4.2.
- Restabilit phoenix 0.4.2; actualizată numai versiunea rădăcină a aplicației la 0.5.1.
- npm ci --dry-run --offline trece după corecție.
- Test de regresie pentru concordanța versiunilor din lockfile și a arhivelor.
- Nicio modificare în date, SQL sau comportamentul aplicației.
- npm ci real într-un folder gol: reușit, 86 de pachete instalate; fără node_modules preexistent.
- Clientul Supabase și clientul SSR se încarcă din instalarea curată; Phoenix instalat: 0.4.2.
