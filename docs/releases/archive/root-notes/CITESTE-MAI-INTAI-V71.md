# SongApp v71 — 0.12.0 — Instalare pe telefon (PWA)

Actualizare peste v70 (0.11.5). Nu este o arhivă completă. Nu necesită SQL sau dependențe noi.

## 1. Instalează actualizarea pe calculator
Oprește aplicația cu Ctrl+C. Extrage arhiva în D:\Apps\song.app și acceptă înlocuirea fișierelor. Nu modifica .env.local.

```powershell
Set-Location "D:\Apps\song.app"
npm run build
if ($LASTEXITCODE -eq 0) { npm run local }
```

## 2. Publică pentru testarea de pe telefon
După build reușit, oprește serverul cu Ctrl+C și verifică fișierele:

```powershell
git status --short
git diff --stat
```

Nu include fișiere .env, arhive personale sau backupuri. Apoi:

```powershell
git add app/manifest.ts app/layout.tsx app/welcome.css "app/(app)/account/page.tsx" components/InstallApp.tsx components/WelcomePage.tsx lib/supabase/middleware.ts public/icons package.json package-lock.json CITESTE-MAI-INTAI-V71.md
git commit -m "Release v71 0.12.0: instalare SongApp pe telefon"
git push origin main
```

Așteaptă Published în Netlify. Nu am făcut push/deploy în numele tău.

## 3. Android
1. Deschide https://songappbcb.netlify.app în Chrome, în mod normal (nu incognito).
2. Din josul paginii, extinde „Instalează SongApp pe telefon”. Dacă este disponibil, apasă „Instalează aplicația”. Alternativ: meniul ⋮ din Chrome → „Adaugă pe ecranul de pornire” / „Instalează aplicația”. Denumirile depind de versiunea telefonului.
3. Deschide SongApp din iconița nouă, apoi autentifică-te. Programele publice sunt accesibile și fără cont.

## 4. iPhone
1. Deschide https://songappbcb.netlify.app în Safari.
2. Partajează → „Adăugați la ecranul principal”. Activează „Deschide ca aplicație web”, dacă apare, apoi „Adăugați”.
3. Deschide noua iconiță SongApp. Este posibil să fie necesară autentificarea din nou în aplicația instalată.

## 5. Ce verificăm pe telefon
- Deschidere din iconiță, fără bara normală a browserului.
- Login, închidere/redeschidere și revenire din fundal.
- Deschidere program public ca vizitator și trimitere propunere (doar dacă programul permite).
- Căutare/adăugare cântare, solist/observații, mutare ordine, culori și backup.
- PDF și descărcare PPT (telefonul poate cere o aplicație compatibilă pentru PPT).

Aceste verificări finale trebuie făcute pe telefoanele reale. Verificările automate folosesc browser Chromium și un backend de test, nu conturile reale sau Safari/iOS nativ.

## Limite și costuri
Nu sunt necesare conturi de dezvoltator Apple/Google sau publicare în magazine. Se folosește același site și aceeași bază de date; traficul și buildurile se încadrează în limitele hostingului existent, fără o garanție de trafic nelimitat gratuit.

Această versiune necesită internet și nu salvează date private pentru utilizare offline. Nu adaugă un service worker de cache și nu schimbă mecanismul existent de notificări. Nu adaugă notificări push garantate când aplicația este închisă. Actualizările se primesc din site la încărcare, fără reinstalare obișnuită.

Instalarea de pe telefon trebuie încercată pe adresa HTTPS publicată; localhost de pe calculator nu este accesibil ca localhost de pe telefon.

Documentație: https://nextjs.org/docs/app/guides/progressive-web-apps și https://support.apple.com/en-eg/guide/iphone/iphea86e5236/ios
