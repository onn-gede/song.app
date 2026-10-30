# SongApp v62 / 0.9.0 — patch peste v61 / 0.8.4

1. Închide serverul local cu Ctrl+C. Copiază conținutul arhivei peste D:\Apps\song.app, lângă package.json. Păstrează .env.local, .git și local-assets.
2. În același proiect Supabase, SQL Editor, rulează supabase/updates/UPDATE-V62.sql. Este actualizare pe baza existentă, nu instalare nouă. Necesită migrările până la v59 deja aplicate. Nu șterge cântări și nu reimportă fișiere.
3. PowerShell, pe rând:

    Set-Location "D:\Apps\song.app"
    npm ci
    npm run build

Continuă doar dacă buildul reușește:

    npm run local

Nu este nevoie să repeți importul celor 803 PPT/PDF. Nu s-a făcut push sau deploy.

## Unde găsești funcțiile

- În program: tagurile Strofe și Structură. Apasă Structură sau creionul de lângă solist/observații pentru completare. Structura în program se poate lăsa goală pentru a folosi structura de bază a cântării.
- Pentru PPT/PDF: numărul de strofe se completează manual; nu este numărul de slide-uri. Structura este o indicație afișată, fără schimbarea fișierelor originale.
- La căutare: Versuri ⓘ și Căutare avansată (colecție/categorie/tonalitate).
- În /songs: Versuri ⓘ și + Categorie.
- În programul partajat: conturile active cu drept de editare au direct comenzile de administrare. Fără cont sau cu rol doar de vizualizare, pagina rămâne publică/read-only. Nu se acordă drepturi noi conturilor viewer.
- Chenarul roșu dispare după 5 secunde de la afișarea modificării. Actualizarea altor dispozitive respectă intervalul de verificare live existent.

Raportul complet: docs/verification/VERIFICARI-V62.md.
