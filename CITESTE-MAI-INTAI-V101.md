# SongApp v101 · 0.30.0

Această versiune include cumulativ modificările din v100 și adaugă recuperarea parolei.

## Ce este nou

- „Ai uitat parola?” pe pagina de autentificare;
- recuperare prin emailul implicit Supabase;
- pagină securizată pentru alegerea parolei noi;
- administratorii pot seta o parolă temporară din `Administrare → Conturi și aprobări`;
- resetarea administrativă este înregistrată în jurnalul de activitate;
- mesajele de recuperare nu confirmă dacă o adresă există sau nu.

## Baza de date

Nu există SQL nou pentru recuperarea parolei. Dacă nu ai instalat încă v100, rulează `supabase/updates/UPDATE-V100.sql` o singură dată.

## Configurare Supabase obligatorie

În `Authentication → URL Configuration` păstrează URL-ul live al aplicației ca **Site URL** și adaugă la **Redirect URLs**:

- `https://songappbcb.netlify.app/reset-password`
- `http://localhost:3000/reset-password`

Înlocuiește adresa Netlify dacă domeniul live este diferit.

Serviciul implicit Supabase este suficient pentru limita acceptată de două emailuri pe oră; nu este necesar SMTP separat.

## Test local

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run build
npm run local
```

Testează:

1. pagina de login → `Ai uitat parola?`;
2. deschiderea linkului primit și stabilirea parolei noi;
3. `Administrare → Conturi și aprobări → Resetează parola`;
4. autentificarea cu parola temporară.
