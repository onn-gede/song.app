# SongApp v104 · 0.33.0

Arhiva este completă și cumulativă. Nu suprascrie `.env.local`.

## Wishlist public colaborativ

- un wishlist rămâne privat implicit;
- după publicare, orice vizitator cu linkul poate adăuga direct o cântare;
- nu mai există etapă de aprobare sau respingere;
- cântarea apare imediat în wishlist;
- aceeași cântare nu poate fi adăugată de două ori;
- sunt păstrate limitele de protecție împotriva adăugărilor automate excesive;
- utilizatorii cu drept de editare au buton vizibil `Elimină` la fiecare element;
- eliminarea nu cere justificare și nu influențează istoricul cântărilor;
- eventualele propuneri rămase în așteptare din v103 sunt introduse automat în wishlist la actualizare.

## Actualizarea bazei existente

În Supabase → SQL Editor rulează o singură dată:

`supabase/updates/UPDATE-V104.sql`

Fișierul este cumulativ peste v83 și include toate actualizările necesare pentru wishlist.

## Validare locală

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run build
npm run local
```

Deschide linkul unui wishlist public într-o fereastră privată, adaugă o cântare și verifică apariția imediată. Revino în pagina internă și folosește `Elimină`.
