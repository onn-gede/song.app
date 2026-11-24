# SongApp v74 — 0.12.3 — Corecție funcții publice vechi

## Constatări din diagnosticul primit
- Varianta de sugestii cu 8 argumente nu verifică allow_contributions și permite ocolirea protecțiilor versiunii noi.
- Varianta instalată cu 9 argumente verifică allow_contributions, dar nu are bugetele v73 și încă nu acceptă Diverse (other).
- bulk_update_import_status verifică deja can_edit_content. Accesul anonim la EXECUTE este inutil; singur nu demonstrează posibilitatea modificării fără autorizare.

## Remediere pregătită
- UPDATE-V74.sql include compatibilitatea tipurilor de momente din v59 și limitele v73, deci este utilizabil și dacă UPDATE-V73.sql nu a fost executat.
- Vechea semnătură delegă la cea protejată, cu toate cele 9 argumente specificate. Rămâne accesibilă clienților vechi; nu mai are o implementare separată de insert.
- Anon nu mai poate apela bulk_update_import_status; utilizatorii autentificați sunt în continuare verificați de funcția existentă. Nu se creează funcția dacă lipsește.
- Nu se șterg cântări, programe sau propuneri. Bucketul și celelalte permisiuni nu sunt schimbate.

## Lucru local
Arhiva se extrage peste v73 în D:\Apps\song.app. Oprește serverul înainte. Păstrează .env.local.

```powershell
Set-Location "D:\Apps\song.app"
npm test
if ($LASTEXITCODE -eq 0) { npm run build }
if ($LASTEXITCODE -eq 0) { npm run local }
```

Nu există dependențe noi față de v73. Nu este nevoie de npm ci dacă v73 este deja instalat.

## SQL — pregătit, nu executat pe Supabase real
Fișier: supabase/updates/UPDATE-V74.sql. Se aplică pe aceeași bază SongApp cu migrările până la v67; înlocuiește necesitatea rulării separate a UPDATE-V73.sql. Testele rulează într-o bază izolată PGlite.

NU rula supabase/setup/INSTALL-NEW.sql pe baza existentă.

Dacă alegi să rulezi UPDATE-V74.sql în proiectul Supabase comun cu site-ul public, protecțiile se aplică imediat și pe live, chiar fără deploy. Pentru a păstra totul izolat, testează SQL pe o bază separată sau păstrează migrarea pregătită. Eu nu am executat-o pe baza reală și nu am făcut push/deploy.

Verificarea după aplicare: vechea funcție are security_definer=false (wrapper invoker), bugetele sunt în funcția cu 9 argumente, iar anon_execute=false pentru bulk_update_import_status. Testează sugestie normală și tip Diverse, link cu sugestii oprite și link expirat. O sugestie validă rămâne pending și necesită aprobare.

Limitele per link sunt comune tuturor vizitatorilor; nu sunt identificare individuală și nu înlocuiesc protecțiile anti-DDoS/rate limits de autentificare.
