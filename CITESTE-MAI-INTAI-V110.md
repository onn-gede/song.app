# SongApp v110 / 0.39.0

Această arhivă continuă versiunea v109.2 și actualizează biblioteca de cântări.

## Actualizare în folderul unic SongApp

1. Oprește aplicația locală.
2. Păstrează o copie a fișierului `.env.local`.
3. Copiază conținutul arhivei v110 peste folderul SongApp existent.
4. Pune `.env.local` la loc numai dacă a fost înlocuit.
5. În Supabase SQL Editor rulează o singură dată `supabase/updates/UPDATE-V110.sql`.
6. Rulează:

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run validate
npm run local
```

Nu este nevoie să creezi un folder nou. Pentru verificările manuale, vezi `docs/validation/START-AICI-V110.md`.
