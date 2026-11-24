# SongApp v107 / 0.36.0

Această arhivă este completă și include reorganizarea de cod din v105, funcțiile v106 și actualizarea vizuală v107.

## Instalare sigură

1. Extrage arhiva într-un folder nou, de exemplu `D:\Apps\SongApp-v107`.
2. Nu suprascrie folderul v105 sau v106 care funcționează.
3. Copiază numai `.env.local` din versiunea validată anterior.
4. Nu există SQL nou pentru v107. Dacă ai rulat deja `UPDATE-V106.sql`, baza este pregătită.
5. Rulează:

```powershell
Set-Location "D:\Apps\SongApp-v107"
npm ci
npm run validate
npm run local
```

Pentru verificările manuale, vezi `docs/validation/START-AICI-V107.md`.
