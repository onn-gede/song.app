# Verificări v57 / 0.7.5

Data: 29.10.2026. Lucru local, fără push sau deploy și fără conectare la baza reală a utilizatorului.

- `npm test`: 64 teste TypeScript/PostgreSQL PGlite și 7 teste pentru importul cărților, toate trecute.
- `npm run build`: build de producție Next.js și verificarea TypeScript trecute.
- SQL: toate migrările, instalarea nouă și UPDATE-V57 aplicat de două ori în baza de test.
- Căutare reală SQL: 063 / 63 / Nr. 063 găsesc corespondente din trei colecții, inclusiv după peste 100 de surse pentru o singură piesă. Adăugarea păstrează sursa selectată și repetarea aceleiași cereri nu dublează elementul.
- Import real în PGlite al tuturor celor 601 payloaduri CR și 266 CN, apoi repetarea fiecărui import: aceleași ID-uri, fără duplicate. Catalogele acoperă 1200 / 482 ID-uri API.
- Reparare: versurile modificate sunt înlocuite cu catalogul verificat, iar versiunea veche este copiată în tabelul privat. O piesă împărțită cu o altă colecție este separată fără a rescrie cealaltă ediție; elementul de program cu sursa cărții urmărește noua versiune.
- Arhivare: catalogul incomplet este respins; o copie veche cu același număr poate fi arhivată după confirmarea tuturor cântărilor. Numărul final rămâne corect.
- Drepturi: vizualizatorul nu poate importa, adăuga în program, modera sau citi copiile private ale versurilor; anonimul nu poate folosi funcțiile interne. Starea de moderare nu poate fi modificată direct de utilizator.
- Browser Chromium, aplicație în modul production cu Supabase simulat: paginație sus/jos, salt pagină, reset filtre, căutare 063, alegere explicită a colecției și confirmarea adăugării; variante separate în program și golirea căutării după succes.
- Browser: moment Diverse cu culoare aleasă (inclusiv bordura efectivă), layout mobil 390px fără depășire orizontală; modificarea opacității colecției se reflectă după salvare; respingerea/eliminarea unui cont; butonul public și spațierea pe dashboard.
- Browser: pagina programului partajat se deschide după ștergerea cookie-urilor de autentificare. Fără erori JavaScript în verificări.
- `node scripts/import-books.mjs --prepare-only`: validează catalogele incluse fără scriere în Supabase. Sintaxa celor două scripturi de import/pregătire este validă.

Nu este o comparație directă cu versurile din baza utilizatorului: importul și repararea pe acea bază se execută local, prin `npm run import:books`, după UPDATE-V57. Conflictele de identitate sursă sunt raportate pentru verificare și împiedică arhivarea incompletă. Catalogele sunt cele verificate din 29.10.2026, nu o sincronizare permanentă.
