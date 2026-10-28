# Verificări v50 / 0.6.2

## Ce se schimbă

- Un program gol deschide căutarea automat și îi dă focalizarea. Panoul poate fi închis manual; rămâne deschis după primele adăugări.
- La adăugarea reușită în principal sau backup, căutarea se golește, rezultatele se resetează și cursorul revine în câmp. Eșecul păstrează căutarea.
- Editorul de solist/observații se închide numai după confirmarea salvării. Erorile păstrează formularul deschis și textul introdus; salvarea repetată este blocată în timpul cererii.
- Tonalitatea apare distinct lângă titlu și se poate completa în editorul piesei. Câmpul gol folosește tonalitatea implicită a cântării. Lipsa ambelor valori este afișată ca „Tonalitate —”, fără a inventa o gamă.
- Prezentarea programului selectează tonalitățile din baza de date și le transmite fiecărui slide. Tonalitatea programului are prioritate; momentele text nu moștenesc tonalitatea cântării anterioare. Prezentarea individuală folosește tonalitatea implicită.

## Verificări

- 49 teste trecute, zero eșecuri; inclusiv prioritatea tonalității programului, fallback-ul la cea implicită, lipsa gamei și trecerea la momente text. Sunt păstrate testele bazei, accesului, căutării și creării idempotente din v49.
- Build de producție și verificare TypeScript: trecute cu configurare fictivă.
- Verificare Chromium pe build de producție, cu Supabase simulat: căutare automată și focalizare, adăugare în principal și backup cu resetare, salvare respinsă cu păstrarea editorului și draftului, salvare confirmată cu închidere și afișare fără refresh, redeschidere cu valorile salvate, tonalitate vizibilă pe desktop și mobil, tonalitatea programului și cea individuală în prezentări.
- Fără acces la datele sau credențialele Supabase reale. Nu s-a publicat automat pe Netlify.

## Instalare

Nu există migrare SQL nouă pentru v50. Baza trebuie să aibă deja UPDATE-V49.sql.
Actualizează sursele și publică versiunea 0.6.2. Nu încărca fișierele reale .env.local sau .env.worker.
