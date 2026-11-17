# SongApp v83 · tonalitate, prezentare, import mobil și YouTube

Versiune aplicație: `0.18.0`.

## Înainte de pornire

Rulează o singură dată în SQL Editor din proiectul Supabase existent:

`supabase/updates/UPDATE-V83.sql`

Actualizarea păstrează datele existente. Adaugă linkul YouTube pe cântări și normalizează/salvează tonalitatea la nivelul bazei de date pentru toate traseele de scriere.

## Validare locală

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm test
npm run build
npm run local
```

## Verificări funcționale recomandate

1. Editează tonalitatea implicită a unei cântări și redeschide cântarea.
2. Adaugă aceeași cântare într-un program existent și într-un program nou, cu o tonalitate aleasă în dialog.
3. Editează tonalitatea elementului din program pe desktop și pe mobil.
4. În `Import → Din text`, lipește versurile și alege o categorie inițială.
5. Deschide o cântare, adaugă un link YouTube și pornește playerul.
6. Deschide un link public într-o aplicație de mesagerie și verifică titlul programului în preview.
7. Deschide prezentarea: textul trebuie să fie mai mare, iar bara de sus să apară doar la hover/focus sau prin atingerea marginii de sus.

## Rezultatul validării automate

- TypeScript: trecut;
- 111 teste: trecute (99 + 7 + 3 + 2);
- migrare nouă și instalare completă într-o bază goală: trecute;
- build Next.js: trecut după confirmarea avertismentului de securitate al frameworkului.

Next.js 16.4.3 afișează un avertisment de securitate și recomandă upgrade. Upgrade-ul frameworkului trebuie făcut separat și retestat înainte de deploy.

