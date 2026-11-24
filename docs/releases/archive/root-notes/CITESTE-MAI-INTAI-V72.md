# SongApp v72 — 0.12.1 — Actualizare de securitate

Pachet peste v71 / 0.12.0; fără migrare de bază de date. Nu include PWA-ul întreg: instalează v71 înainte dacă nu l-ai instalat încă.

## Instalare
Oprește aplicația (Ctrl+C), extrage peste D:\Apps\song.app și acceptă înlocuirea. Nu modifica .env.local.

```powershell
Set-Location "D:\Apps\song.app"
npm ci
if ($LASTEXITCODE -eq 0) { npm audit }
if ($LASTEXITCODE -eq 0) { npm test }
if ($LASTEXITCODE -eq 0) { npm run build }
```

Nu folosi npm audit fix --force. Dacă o comandă eșuează, oprește-te la eroarea respectivă. Pentru test local după build reușit: npm run local.

După validarea locală, publicarea este prioritară pentru a actualiza și serverul live. Oprește serverul, verifică git status --short, apoi:

```powershell
git add package.json package-lock.json next.config.ts app/login/actions.ts app/api/song-files .github/workflows/validate.yml CITESTE-MAI-INTAI-V72.md RAPORT-SECURITATE-V72.md VERIFICA-SECURITATE-V72.sql
git commit -m "Release v72 0.12.1: actualizare securitate Next.js si dependente"
git push origin main
```

Dacă v71 nu a fost urcat, include separat și fișierele acelui pachet în commit, conform instrucțiunilor v71. Nu include .env, arhive sau backupuri. Nu am făcut push/deploy în numele tău.

VERIFICA-SECURITATE-V72.sql este un diagnostic opțional, numai citire. Nu este o migrare obligatorie.
