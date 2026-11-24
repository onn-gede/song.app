# Validare v107 — programe și calendar

Nu există un fișier SQL nou pentru această versiune. Dacă baza existentă are deja `UPDATE-V106.sql`, nu mai rulezi nimic în Supabase.

## Pornire locală

```powershell
Set-Location "D:\Apps\SongApp-v107"
npm ci
npm run validate
npm run local
```

## Verificări manuale

1. Deschide un program creat de userul curent și verifică iconița de editare de lângă dată.
2. Deschide cu alt editor un program creat de alt user: iconița de editare nu trebuie să apară.
3. Un administrator trebuie să poată edita orice program viitor.
4. Verifică lacătul public/privat și opțiunile complete din „Partajare și administrare”.
5. Verifică clopotul de notificări și numărul afișat numai când există propuneri.
6. Verifică FreeShow Sync și corectarea primului vers.
7. În `/meetings`, verifică primele trei carduri, tabelul, paginația și calendarul pe desktop și mobil.
8. Confirmă că o pagină nu afișează mai mult de șase programe: trei carduri și cel mult trei rânduri sau șase rânduri fără carduri.
