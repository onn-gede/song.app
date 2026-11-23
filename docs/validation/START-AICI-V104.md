# Validare v104

1. Rulează `supabase/updates/UPDATE-V104.sql`.
2. Rulează `npm ci`, `npm run build` și `npm test`.
3. Publică un wishlist și deschide linkul fără autentificare.
4. Adaugă direct o cântare și verifică apariția imediată.
5. Încearcă să adaugi aceeași cântare încă o dată: nu trebuie duplicată.
6. Autentifică-te și elimină elementul, fără justificare.
7. Confirmă că wishlistul nu afectează istoricul sau statisticile cântărilor.
