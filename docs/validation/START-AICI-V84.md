# SongApp v84 · 0.19.0

Această versiune adaugă playlisturi pentru idei de repetiție, editarea întâlnirilor active și YouTube în programul public/live. Îmbunătățește pornirea pe mobil și reorganizează pagina Administrare.

## Ordinea locală

1. Rulează `supabase/updates/UPDATE-V84.sql` o singură dată în Supabase SQL Editor.
2. În PowerShell, din `D:\Apps\song.app`, rulează:

```powershell
npm ci
npm test
npm run build
npm run local
```

3. Verifică local înainte de orice push/deploy.

## Verificări recomandate

- creează un playlist și adaugă/mută/elimină două cântări;
- confirmă că playlistul nu modifică istoricul cântărilor;
- editează titlul, data, ora și tipul unui program viitor;
- deschide linkul public și verifică butonul YouTube;
- verifică faptul că „Cântare în comun” apare public numai când este activă;
- deschide aplicația pe mobil și verifică ecranul luminos de pornire;
- deschide Administrare și verifică noile carduri.
