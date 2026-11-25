# Validare v109 — program, mobil, print și administrare

## 1. SQL

Rulează o singură dată în Supabase SQL Editor:

`supabase/updates/UPDATE-V109.sql`

Migrarea păstrează confirmarea „versurile sunt corecte”. Dacă versurile sunt editate ulterior, confirmarea veche nu mai ascunde propunerea de verificare.

## 2. Pornire locală

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run validate
npm run local
```

## 3. Verificări manuale

1. Deschide o cântare de tineri propusă pentru repararea primului vers. Verifică cele două acțiuni pe același rând: corectare și confirmarea versurilor actuale.
2. Confirmă versurile actuale, reîncarcă pagina și verifică dispariția propunerii. O editare ulterioară a versurilor trebuie să permită o verificare nouă.
3. Pe Dashboard, verifică butonul `×` din dreapta fiecărei cântări recente și dialogul de confirmare.
4. În pagina programelor și pe pagina publică, programele trecute trebuie să fie gri, fără accentul colorat al programelor viitoare.
5. În editorul programului, titlul cântării trebuie să ocupe primul rând; tonalitatea, numărul, colecția, strofele și acțiunile apar pe rândul următor.
6. Marcajul „Cântare comun” neactivat trebuie să fie discret tăiat și să redevină normal după activare.
7. Din Administrare → Backup și restaurare, verifică separat backupul complet ZIP și exportul bazei de date JSON.
8. Din Import → Din text, verifică pe mobil câmpul vizibil pentru linkul YouTube.
9. Autentifică-te cu succes: după login, loaderul cu verset trebuie să apară imediat și să rămână 4 secunde.
10. Creează un program nou, inclusiv din fereastra unei cântări: loaderul trebuie să apară imediat și să rămână 4 secunde.
11. Navighează între pagini rapide: loaderul nu trebuie să apară dacă încărcarea se încheie în 1,8 secunde. La o încărcare obișnuită mai lentă, loaderul apare după pragul de 1,8 secunde și rămâne vizibil 4 secunde.
12. Pe mobil, verifică butoanele fixe de salvare: late, centrate și ridicate deasupra insignei Netlify.
13. Folosește Print / PDF și verifică antetul, detaliile programului, numerotarea și separarea clară a elementelor pe A4.
