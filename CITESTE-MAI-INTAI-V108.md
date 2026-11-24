# SongApp v108 / 0.37.0

Această arhivă este completă și pornește de la versiunea v107 validată.

## Instalare sigură

1. Extrage arhiva într-un folder nou, de exemplu `D:\Apps\SongApp-v108`.
2. Nu suprascrie folderul care funcționează acum.
3. Copiază numai `.env.local` din versiunea validată anterior.
4. În Supabase SQL Editor rulează o singură dată `supabase/updates/UPDATE-V108.sql`.
5. Rulează:

```powershell
Set-Location "D:\Apps\SongApp-v108"
npm ci
npm run validate
npm run local
```

Fișierul SQL păstrează tonalitățile introduse manual. Completează numai tonalități lipsă din colecția de tineri, dacă numărul și titlul corespund sigur referinței.

Pentru verificările manuale, vezi `docs/validation/START-AICI-V108.md`.
