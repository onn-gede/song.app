# SongApp v102 · 0.31.0

Arhiva este completă și cumulativă: include v100, v101 și toate modificările anterioare.

## Import restructurat

- versurile importate din link sunt afișate direct pe secțiuni editabile;
- fiecare secțiune are tip, etichetă, text și poziție;
- strofele primesc automat `Strofa 1`, `Strofa 2`, `Strofa 3` după ordinea curentă;
- Refren, Bridge, Pre-refren și Final primesc etichete implicite, dar pot fi redenumite manual;
- etichetele scrise manual nu sunt suprascrise la reordonare;
- un rând liber în text separă automat o secțiune nouă de același tip;
- secțiunile se mută prin drag-and-drop sau cu săgețile;
- structura interpretării se completează automat după secțiuni și poate fi ajustată manual;
- importul încearcă să păstreze tipurile indicate de site și recunoaște calupurile identice repetate drept refren;
- denumirile secțiunilor nu sunt salvate în textul versurilor.

## YouTube

Sugestiile YouTube apar direct în preview-ul importului după selectarea colecției Tineri. Linkul se salvează numai după alegerea sau confirmarea utilizatorului.

## Baza de date

Nu există SQL nou pentru v101 sau v102. Dacă `UPDATE-V100.sql` nu a fost încă rulat, rulează o singură dată:

`supabase/updates/UPDATE-V100.sql`

## Validare locală

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run build
npm run local
```

Teste recomandate:

1. importă o cântare cu Strofa/Refren/Bridge explicit;
2. adaugă un rând liber într-un calup;
3. schimbă un tip și verifică renumerotarea strofelor;
4. redenumește manual `Refren` în `Refren 2`;
5. reordonează pe desktop și mobil;
6. selectează colecția Tineri și verifică sugestiile YouTube.
