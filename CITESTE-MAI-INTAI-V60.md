# Patch SongApp v60 / 0.8.3 — peste v59.1 / 0.8.2

Copiază fișierele din arhivă peste aplicația existentă, lângă package.json. Păstrează .env.local, .git și local-assets. Este un patch, nu o aplicație completă.

Corectează tipul momentului Diverse/Cântare în print și prezentare. Include raportul verificărilor. Nu necesită migrare SQL și nu repetă importul.

În PowerShell, în D:\Apps\song.app:

    npm ci
    npm run build
    npm run local

Publicarea nu a fost făcută. Testează local; Git/Netlify se actualizează separat când alegi să publici.

## Confirmarea celor 803 fișiere pe live

Deschide docs/verification/VERIFY-803-ONLINE.sql și rulează-l în SQL Editor, în ACELAȘI proiect Supabase. Este DOAR CITIRE, nu este o migrare.

Rezultatul așteptat: colectii_ppt=1, total_inregistrari=803, cantari_distincte=803, complete_cu_ppt_si_pdf=803, incomplete=0, numere_lipsa=NULL, numere_neasteptate=NULL.

A doua interogare arată dacă cele două linkuri publice vechi mai sunt active. Trimite rezultatele pentru confirmarea finală; nu trimite chei sau parole.

Vezi docs/verification/VERIFICARI-V60.md pentru rezultate și limitele verificării.
