# Lucru local

## Folder curat

Extrage în `D:\Apps\SongApp-local`, nu peste folderul vechi. Extragerea unui ZIP nu elimină fișierele istorice mutate între directoare.
Copiază `.env.local` din vechea aplicație, fără node_modules, .next sau dist-worker. În noul .env.local schimbă numai adresa aplicației în `NEXT_PUBLIC_SITE_URL=http://localhost:3000`; păstrează aceleași valori Supabase.

```powershell
Set-Location "D:\Apps\SongApp-local"
npm ci
npm run local
```

Pentru pornirile ulterioare: `npm run local` sau dublu click pe PORNESTE-APLICATIA.cmd.
Pentru oprire: Ctrl+C în terminal.

## Date și conturi

Aplicația rulează pe laptop și folosește aceeași bază Supabase online. Autentificarea, biblioteca și programele existente rămân disponibile. Modificările datelor se văd și în aplicația găzduită.

Nu se creează o bază nouă, nu se execută SQL automat și pentru v56 se aplică supabase/updates/UPDATE-V56.sql după UPDATE-V55.sql în aceeași bază existentă. Linkurile localhost funcționează pe calculatorul pe care rulează aplicația; partajarea către alte persoane revine în discuție la publicare.

## Moduri de rulare

`npm run local` compilează numai când sursele sunt mai noi decât build-ul, apoi pornește versiunea optimizată. Compilarea poate solicita temporar procesorul.

`npm run dev` este pentru editare cu recompilare automată. Nu ține ambele moduri pornite pe portul 3000. Oprește procesul după lucru.

## Validare înainte de publicare

1. Verificăm funcțiile local, pe desktop și mobil după caz.
2. Rulăm testele și build-ul local.
3. Corectăm problemele și repetăm verificările relevante.
4. Numai după acceptarea versiunii urcăm sursele în Git și decidem deploy-ul.

Nu trebuie schimbate setări Netlify pentru acești pași. Nu executa git push, netlify deploy sau trigger deploy în timpul validării locale.

## Unde sunt fișierele SQL

- supabase/setup: instalare de la zero și bootstrap admin. Nu rula instalarea nouă pe baza existentă.
- supabase/updates: pachetele de actualizare între versiuni.
- supabase/migrations: fișierele SQL sursă.
- supabase/legacy: variante istorice, pentru referință.

`npm run sql:package` doar regenerează pachetele pe disc. Nu are nevoie de chei și nu se conectează la Supabase.
