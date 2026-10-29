# Verificările calupului v42

- Compilare de producție Next.js: trecută.
- Verificare TypeScript și compilare worker: trecute.
- 18 teste automate: trecute.
- PostgreSQL local prin PGlite, cu extensiile reale unaccent / pg_trgm / pgcrypto.
- Instalare nouă și actualizare SQL: executate pe baze de test.
- Bibliotecă de test: 5.205 cântări, paginare fără limita anterioară de 5.000.
- Permisiuni: admin, viewer, profil inactiv și acces anonim.
- Coada: dublă pornire, exclusivitate, reluare după expirarea blocării,
  refuzarea rezultatelor unui worker vechi, anulare și păstrarea editărilor locale.
- Programe: duplicare, șabloane excluse din istoricul utilizării, responsabili,
  link public activ și expirat, ordinea slide-urilor și cântări repetate.

Validarea pe Supabase-ul real, accesarea sursei externe actuale și verificarea
vizuală în browser/dispozitive reale rămân pentru instalarea la utilizator.
Nu au fost utilizate cheile sau datele reale ale utilizatorului.
