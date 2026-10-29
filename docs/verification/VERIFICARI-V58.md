# Verificări v58 / 0.8.0

Sursa este arhiva PPT furnizată de utilizator. Nu s-a conectat importatorul la baza reală a utilizatorului; importul efectiv se execută local după UPDATE-V58.

- 803 originale PPT, numerele 001–803 fără goluri/numere duplicate. 803 amprente SHA-256 distincte. Două perechi de titluri repetate, păstrate pe pozițiile originale.
- 803 PDF-uri valide, 4414 pagini/slide-uri; fiecare PDF are pagini și structură citibilă de pdfinfo. Originalele și PDF-urile au amprente verificate înainte de orice conectare la Supabase.
- Control vizual al previzualizărilor și al vizualizatorului în browser la dimensiuni desktop și mobil. Navigare efectivă între slide-uri, inclusiv prin tastatură; PDF-ul este desenat în canvas, fără a depinde de extensia PDF a browserului.
- `npm test`: 66 teste TypeScript/PostgreSQL, 7 teste API/cărți și 2 teste pentru arhiva PPT/PDF, toate trecute (75 în total).
- Integrare SQL: înregistrarea tuturor celor 803 titluri/atașamente, repetare fără dubluri, numărătoare colecție 803 și căutare 063. Nicio condiție de 805 cântări și nicio transcriere obligatorie a versurilor.
- Încărcarea se confirmă numai când originalul și PDF-ul există în Storage. Lipsa originalului/PDF-ului este refuzată. Reluarea păstrează aceeași identitate; un hash schimbat invalidează confirmarea până la reîncărcare.
- Editările locale de titlu, tonalitate și versuri sunt păstrate. Colecția implicită se identifică stabil și după redenumire.
- Piesa fără versuri se poate adăuga într-un program și păstrează sursa selectată. Importul nu arhivează și nu dezactivează piese existente.
- Viewerul/inactivul/anonimul nu pot importa sau confirma fișiere; descărcarea și pagina prezentării refuză accesul anonim. Funcțiile vechi de import API CN parțial rămân blocate.
- UPDATE-V58 aplicat repetat și instalarea nouă trecute în baza PGlite. Funcțiile au granturi explicite; nu s-au creat tabele publice noi.
- Browser, aplicație production cu Supabase simulat: încărcarea unui PPT real, detectarea PDF-ului inclus, eroare de upload PDF injectată și reluare fără dubluri, pagină atașament, PDF desenat efectiv, taste/controale slide și descărcarea originalului. Layout mobil fără depășire orizontală. Fără erori JavaScript.
- `npm run build`: build de producție și verificarea TypeScript trecute. PDF.js este încărcat doar în vizualizator; workerul este local și corespunde versiunii fixate 5.4.296.
- `node scripts/import-black-ppt.mjs --prepare-only`: verificare completă a celor 803 PPT și PDF, fără conectare la Supabase.

Limitări deliberate: fișierele 804/805 nu există în arhivă; versurile nu sunt transcrise în câmpurile aplicației; previzualizările PDF sunt statice. Prezentarea textuală a întregului program nu devine automat un deck PPT combinat. Pentru această etapă sunt disponibile titlurile, numerele, originalele și deschiderea fiecărei prezentări.

Nu s-a făcut push sau deploy Netlify. Arhiva locală include fișierele necesare primei încărcări; acestea sunt excluse din Git și din funcțiile găzduite. După import, vizualizarea folosește stocarea privată Supabase.
