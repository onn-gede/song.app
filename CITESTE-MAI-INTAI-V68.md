# SongApp v68 / 0.11.3 — Fotografia bisericii vizibilă

Actualizare de interfață peste V67. Nu necesită SQL, chei noi sau reinstalarea dependențelor.

1. Oprește aplicația cu Ctrl+C.
2. Extrage acest ZIP peste D:\Apps\song.app, cu înlocuire.
3. În PowerShell:
   Set-Location "D:\Apps\song.app"
   npm run build
4. După build reușit:
   npm run local
5. Reîncarcă http://localhost:3000. Dacă ai o filă mai veche, folosește Ctrl+F5.

Fotografia este acum lângă textul de bun venit, în partea de sus a coloanei din stânga, deasupra formularului. Clădirea este recognoscibilă; câmpurile de autentificare nu o mai acoperă. Marginile rămân estompate, iar fotografia are opacitate suficientă pentru a fi vizibilă.
Pe mobil fotografia rămâne lângă introducere, iar programele publice apar sub autentificare.
Se folosesc aceleași fișiere WebP optimizate: aproximativ 65 KB desktop și 22 KB mobil. Arhiva le include pentru a asigura că sunt prezente în public/images.

Verificări: build de producție Webpack și TypeScript trecute; afișare desktop, mobil 390 px, tabletă 820 px și telefon îngust 320 px; fotografia este încărcată și separată de formular; nu există scroll orizontal sau text tăiat în introducere. Capturile au fost inspectate vizual.
Rămân maximum patru programe, fără paginare. Nu s-a făcut push sau deploy.
