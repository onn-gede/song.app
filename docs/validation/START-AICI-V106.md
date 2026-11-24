# Validare v106 — publicare, mobil și corectare punctuală

1. Păstrează `.env.local` existent și extrage arhiva într-un folder curat.
2. Rulează în Supabase SQL Editor fișierul `supabase/updates/UPDATE-V106.sql` o singură dată.
3. Rulează `npm ci`, apoi `npm run validate`.
4. Pornește local cu `npm run local`.
5. Creează un program oficial și o repetiție; ambele trebuie să aibă imediat butonul „Vezi public”.
6. Verifică „Fă privat”, apoi „Fă public”; același program trebuie să redevină accesibil.
7. Deschide o cântare eligibilă din colecția Tineri și verifică preview-ul „Corectează primul vers lipsă”.
8. Deschide o cântare dintr-un program și verifică revenirea la acel program.
9. Pe mobil, verifică salvarea centrată, comenzile compacte și loaderul de pornire.
10. Fără cheie YouTube, verifică linkul de căutare manuală; cu `YOUTUBE_DATA_API_KEY`, verifică sugestiile automate.

Nu face push sau deploy înainte de validarea locală.
