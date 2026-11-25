# SongApp v109.2 / 0.38.2

Această arhivă continuă versiunea v108 publicată și include comportamentul contextual al loaderului din v109.2.

## Actualizare în folderul unic SongApp

1. Oprește aplicația locală.
2. Păstrează o copie a fișierului `.env.local`.
3. Copiază conținutul arhivei v109 peste folderul SongApp existent.
4. Pune `.env.local` la loc numai dacă a fost înlocuit.
5. În Supabase SQL Editor rulează o singură dată `supabase/updates/UPDATE-V109.sql`.
6. Rulează:

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run validate
npm run local
```

Nu este nevoie să creezi încă un folder cu numele versiunii. După validarea locală poți face commit, push și deploy din același folder.

Pentru verificările manuale, vezi `docs/validation/START-AICI-V109.md`.
