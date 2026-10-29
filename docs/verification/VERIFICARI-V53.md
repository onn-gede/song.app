# Verificări v53 / 0.7.1

## Modificări

- Colecții și categorii folosesc formular cu stare de salvare, blocarea trimiterii repetate, erori vizibile și router refresh după confirmarea acțiunii. Colecția se remontează din valorile salvate; actualizarea/ștergerea verifică existența rândului afectat.
- Căutarea pentru adăugarea cântărilor este deschisă implicit în programe noi și existente.
- Marcaj persistent is_congregational pe meeting_items, implicit false. Butonul Cântare comun devine tag roșu Cântare în comun; poate fi dezactivat. Salvarea aplică snapshot-ul confirmat cu protecție împotriva răspunsurilor vechi.
- Marcajul este specific programului, păstrat la duplicare, share și print; inclus în jurnal. RLS existent se păstrează; momentele fără cântare nu pot primi marcajul.
- Tagurile au text normal neutru, fundal alb și bordură colorată; marcajul în comun este excepția roșie.
- Momente: observații vizibile direct sub titlu, fără solist sau Textul momentului. Editorul păstrează observațiile vechi din ambele câmpuri; la salvare le consolidează fără dublare.

## Validare locală

- 53 teste trecute, zero eșecuri. Include PostgreSQL PGlite: persistență, independență între programe, copiere, share anonim, audit, restricții viewer, rerulare UPDATE-V53 și instalare nouă.
- Build optimizat și verificare TypeScript trecute.
- Interfața verificată în Chromium pe build de producție cu Supabase simulat. Nicio bază sau credențială reală nu a fost accesată.
- Verificări în browser: salvare nume/culoare colecție fără refresh manual, câmp căutare deschis după redeschidere, activare/dezactivare marcaj, persistență după reload, stil calculat neutru pe taguri, observații moment afișate direct, fără solist, pagina publică și ecrane mobile 390/320 px.
- Salvare colecție refuzată de server: eroare vizibilă, textul introdus păstrat, buton reactivat și titlul confirmat anterior nemodificat.
- Editarea observațiilor unui moment se reflectă imediat în program și în pagina publică.
- Fără push, commit automat sau deploy.

## Aplicare

Păstrează .env.local. Pe aceeași bază Supabase, după v52, rulează supabase/updates/UPDATE-V53.sql. Nu rula INSTALL-NEW pe baza existentă. Oprește procesul local înainte de înlocuirea fișierelor; rulează npm ci, npm run build și npm run local pentru a folosi sigur build-ul nou.
