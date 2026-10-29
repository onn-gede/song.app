# Verificări v56 / 0.7.4

## Modificări

- /songs: pagini numerotate cu prima/ultima și vecinii paginii curente; câmp Numărul paginii și buton Mergi. Filtrele și ordonarea se păstrează. URL-urile cu pagini peste total sunt redirecționate la ultima pagină validă.
- Trei ordonări rapide vizibile: Adăugate recent, Cântate recent în programe, Cele mai des cântate. Sunt disponibile și în selectorul de ordonare; schimbarea ordonării revine la pagina 1.
- Cântate recent exclude piesele fără utilizări. Utilizările sunt cele din programe deja începute, o dată per program, fără backup sau șabloane; programele viitoare sunt excluse.
- Colecții: count(distinct song_id) pentru cântări active, calculat în SQL. Elimină descărcarea trunchiată a legăturilor song_sources. Regula coincide cu biblioteca /songs. O eroare de numărare arată — și mesaj, nu un total fals 0.
- Jurnal: implicit modificări, filtre pentru accesări/autentificări/toate și e-mail, etichete în română, numele resursei și câmpurile afectate. Valorile sigure înainte/după sunt afișate; pentru versuri/observații se arată câmpul modificat fără copierea conținutului în jurnal. Codurile sunt în Detalii tehnice.
- Noile evenimente păstrează o etichetă de resursă pentru ștergeri; evenimentele istorice folosesc valorile deja înregistrate sau numele resursei existente. Pentru ștergeri vechi fără denumire stocată se arată explicit că detaliile nu sunt disponibile.

## Verificări

- 68 teste trecute (62 generale/DB + 6 importator Carte roșie).
- DB: peste 1.000 legături simultane, cu totaluri exacte 601 și 700 în două colecții; legătura duplicată nu dublează cântarea; totalul unei colecții coincide cu totalul bibliotecii filtrate.
- DB: cele trei ordonări verificate separat, cu utilizări repetate în același program, backup și program viitor. Testele existente verifică și excluderea șabloanelor.
- DB: denumirea unei cântări rămâne în jurnal după ștergere; modificarea tonalității păstrează valoarea sigură; textul privat al versurilor nu este copiat. Jurnalul nou este refuzat pentru viewer/anonim.
- Etichete: câmpurile interne și sensibile sunt excluse din descrierea modificărilor; rolurile și valorile booleene sunt traduse.
- UPDATE-V56 rerulat și instalare nouă completă verificate cu PGlite.
- Build de producție și verificare TypeScript trecute cu date fictive. Baza reală nu a fost accesată.
- Chromium pe build de producție și Supabase simulat: alegere directă pagina 3, păstrarea colecției/ordonării, pagini numerotate, linkuri rapide care revin la pagina 1, numărătoare colecții 601/700 și jurnal cu denumire/tonalitate F → G/observații modificate. Verificare de încadrare pe mobil la 390 px.

## Aplicare

După v55 rulează supabase/updates/UPDATE-V56.sql pe aceeași bază existentă. Păstrează .env.local; npm ci, npm run build, npm run local. Nu trebuie reluat importul cărții roșii. Nu se creează o bază nouă, nu se șterg cântări și nu se publică nimic.
