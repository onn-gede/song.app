# SongApp v59 / 0.8.1

După v58, pe aceeași bază Supabase.

1. Copiază fișierele peste aplicația existentă. Păstrează .git, .env.local și local-assets/black-book/originals.zip.
2. Rulează supabase/updates/UPDATE-V59.sql în SQL Editor. Dacă nu ai rulat UPDATE-V58.sql, rulează-l înainte.
3. În PowerShell, în folderul aplicației, rulează pe rând:

    npm ci
    npm run build
    npm run local

Tipurile de intervenție sunt identice în public și administrare: Cântare, Diverse, Rugăciune, Poezie, Îndemn, Mesaj, Pauză. Sunt acceptate și momente de tip Cântare scrise liber, fără o piesă din bibliotecă.

## Elimină Powered by Netlify pentru toți vizitatorii

În proiectul songappbcb din Netlify: Project configuration → General → Powered by Netlify badge → Off → Save.
Nu este un text din cod. Nu trebuie redeploy pentru această setare.
Referință oficială: https://www.netlify.com/changelog/2026-08-19-pre-launch-toolbar-and-powered-by-netlify-badge/

## Publicare pe site-ul existent

După SQL și build reușit, în repository-ul local:

    git add .
    git diff --cached --stat
    git commit -m "Release v59 0.8.1: tipuri interventii publice"
    git push origin main

Nu include .env.local, chei sau local-assets în commit. Netlify preia main; dacă publicările automate sunt oprite, pornește deploy din Netlify.

Arhiva include cele 803 previzualizări PDF. Originalele se iau din arhiva ta originală, copiată fără extragere în local-assets/black-book/originals.zip, conform ghidului v58. Nu trebuie repetat importul PPT dacă s-a încheiat deja.

Verificare: build de producție și 42 teste de bază de date trecute, inclusiv propunere anonimă + aprobare pentru toate cele 7 tipuri. Nu s-a publicat automat această versiune și nu s-a modificat baza live.
