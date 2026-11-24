# Verificări v47 / 0.5.0

- 41 de teste automate trecute, inclusiv PostgreSQL/PGlite și RLS.
- Numerotare automată, număr explicit editabil și colecție manuală repetabilă.
- Import generic cu identitate SHA-256, retry idempotent și validare în SQL.
- Melodia: ordine secțiuni, refrene repetate, eliminare acorduri și vizualizări duplicate.
- Alte site-uri: containere de versuri și JSON-LD; nu se importă generic navigarea/articolul complet.
- Adrese locale, DNS mixt public/privat, IPv6 mapat și redirecționări private refuzate.
- Transportul fixează IP-ul validat pentru conexiune, cu limite de timp și dimensiune.
- Unificarea păstrează sursa originală, programul, propunerile, linkurile, tonalitatea și observațiile; versiunile eliminate sunt arhivate.
- Unificarea bulk validează suprapuneri și rulează atomic; candidatele inactive sunt excluse.
- Calendarul include programări viitoare; statisticile de interpretare rămân trecut-only.
- Migrările de actualizare și instalarea nouă sunt executate în teste; actualizarea este repetabilă.
- Build de producție și TypeScript trecute.

HTML-ul real al exemplului Melodia a fost descărcat și analizat: titlul,
8 secțiuni, ordinea și absența marcajelor de acorduri au fost verificate.
Conexiunea directă cu rezoluție DNS fixată nu a putut fi verificată către
site din mediul de lucru (rezoluție DNS indisponibilă); validările URL/DNS
și parserul au fost testate cu răspunsuri controlate. Nu se ocolesc restricțiile site-urilor.

Datele Supabase ale utilizatorului nu au fost accesate. Actualizarea trebuie
rulată în proiectul existent înainte de utilizarea funcțiilor noi.

Scenarii UI în Chromium, cu build de producție și Supabase simulat:
- Salvări repetate, mutare principal/backup, săgeți și tragere.
- Solist și observații; responsabili program; print și mobil fără depășire orizontală.
- 13 răspunsuri vechi forțate nu anulează salvările confirmate.
- Schimbarea programului public este detectată; notificarea în pagină,
  calea notificării native (API simulat) și actualizarea automată au fost verificate.
- Formularele publice sunt închise inițial; importul manual afișează întâi titlul și versurile.
- Selecția tuturor grupurilor afișate și confirmarea unificării au fost executate în UI.
- Butonul din Colecții a fost apăsat și deschide raportul gamelor.
Fără erori JavaScript în aceste scenarii.

Raportul Game Tineri a fost deschis și cu rol viewer activ în testul UI.
