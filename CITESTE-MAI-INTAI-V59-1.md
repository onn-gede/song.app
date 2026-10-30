# Patch v59.1 / 0.8.2 — peste v59 / 0.8.1

Acesta este un patch mic, nu aplicația completă. Copiază conținutul în folderul aplicației existente (lângă package.json), inclusiv folderul .github. Nu necesită SQL și nu modifică datele existente sau importul PPT.

## Cauze confirmate din logurile GitHub

Validate: ENOENT pentru local-assets/black-book/originals.zip. Fișierele locale sunt excluse intenționat din Git. Testul de integritate al celor 803 PPT/PDF este mutat într-o comandă explicită; testele obișnuite verifică în continuare catalogul complet și validarea fișierelor pe date de test independente de fișierele private.

Heartbeat: SUPABASE_URL era gol; SUPABASE_ANON_KEY era prezent. Nu s-a făcut nicio cerere către baza de date în rularea eșuată.

## 1. Configurează URL-ul în GitHub

https://github.com/onn-gede/song.app/settings/variables/actions
Settings → Secrets and variables → Actions → Variables → New repository variable
Name: SUPABASE_URL
Value: valoarea NEXT_PUBLIC_SUPABASE_URL din .env.local (https://...supabase.co).

Cheia SUPABASE_ANON_KEY există deja în Secrets conform logului. Nu copia service_role în locul ei. Setările Netlify nu sunt transferate automat în GitHub Actions.

## 2. Validează și trimite patch-ul

În PowerShell:

    Set-Location "D:\Apps\song.app"
    npm ci
    npm test

Numai dacă acestea reușesc:

    git add package.json package-lock.json tests/black-ppt.test.mjs tests/black-ppt-assets.test.mjs .github/workflows/maintenance.yml scripts/maintenance.mjs
    git commit -m "Fix GitHub CI and maintenance configuration"
    git push origin main

GitHub va porni Validate SongApp pentru noul commit. Acest push poate porni și deploy-ul Netlify dacă este activat automat.

## 3. Repornește health check-ul

https://github.com/onn-gede/song.app/actions/workflows/maintenance.yml
Actions → Database health and heartbeat → Run workflow → main → Run workflow.

## Verificare opțională a tuturor PPT/PDF local

    npm run test:ppt-assets

Aceasta necesită local-assets/black-book/originals.zip și cele 803 PDF-uri. Eșuează dacă lipsesc sau sunt modificate. Importatorul verifică în continuare toate fișierele înainte de orice scriere în Supabase. Nu încărca aceste fișiere în Git.

Nu s-a schimbat accesul la bază și nu s-a ocolit verificarea sănătății: fără configurare sau cu o eroare reală, health rămâne eșuat. Heartbeat-ul singur nu garantează evitarea suspendării unui serviciu.
