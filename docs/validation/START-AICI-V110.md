# Validare v110 — biblioteca de cântări

## 1. SQL

Rulează o singură dată în Supabase SQL Editor:

`supabase/updates/UPDATE-V110.sql`

Update-ul extinde în siguranță interogarea bibliotecii pentru opțiunea explicită „Fără paginare”. Paginarea obișnuită rămâne la 50 de cântări.

## 2. Pornire locală

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run validate
npm run local
```

## 3. Verificări manuale

1. Deschide `Cântări` într-un browser în care nu ai mai folosit v110. Trebuie să fie selectată colecția `Cântări tineri`, iar ordinea să fie `Număr: descrescător`.
2. Schimbă o colecție, ordinea și încă un filtru. Ieși din pagină și revino prin meniul principal: selecția trebuie păstrată.
3. Apasă `Resetează filtrele`: lista trebuie să revină la `Cântări tineri` și `Număr: descrescător`.
4. Pe mobil, alege `Fără paginare · scroll continuu`. Verifică afișarea tuturor rezultatelor și absența controalelor de paginare.
5. Verifică lista pe mobil: rândurile trebuie să fie compacte, fără suprapunerea titlului, tonalității și acțiunilor.
6. O cântare nefolosită în programe trecute nu trebuie să afișeze niciun mesaj despre utilizări.
7. Pentru o cântare folosită, apasă indicatorul roșu `N×` de lângă tonalitate și verifică data ultimei utilizări.
