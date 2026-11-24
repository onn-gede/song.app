# SongApp v80 — 0.15.1

Pachet **cumulativ peste v77**. Include integral v78, v79 și v80, astfel încât nu trebuie să instalezi arhivele intermediare. Nu s-a făcut push sau deploy și nu s-a executat SQL pe proiectul Supabase real.

## Ce s-a schimbat

1. **Momente** este acum o colecție vizuală unică. În pagina Colecții alegi o singură culoare și intensitate, iar stilul se aplică tuturor momentelor existente și viitoare, în editare, pagina publică, LIVE, print și prezentare. Culorile individuale au fost eliminate.
2. Eticheta „Program oficial” nu mai este afișată ca un badge deasupra titlului în lista programelor. Tipul apare discret în subsolul cardului și în antet.
3. Din Setări și administrare poți transforma direct o **Repetiție** în **Program oficial** și invers. Istoricul și statisticile se recalculează conform tipului rezultat.
4. În pagina LIVE, elementele adăugate sau modificate primesc chenar roșu. Chenarul și notificarea rămân până la apăsarea butonului **Am văzut**, inclusiv după refresh-ul automat sau reîncărcarea tabului. Pagina internă de editare nu marchează propriile modificări.
5. În editorul de versuri pe secțiuni, schimbarea tipului actualizează automat eticheta: Refren, Bridge, Pre-refren, Final, Text sau Strofă.
6. La mutarea unei cântări în altă colecție, câmpul Număr este completat cu următorul număr disponibil. Numerele eliberate sunt propuse înaintea unuia nou, iar valoarea poate fi modificată înainte de salvare.
7. Creatorul și ultima modificare a programului afișează numele utilizatorului, niciodată adresa de e-mail. În Administrare → Conturi și aprobări, administratorul poate seta numele afișat al oricărui cont, inclusiv al propriului cont.
8. Prezentarea cântărilor afișează în zona de proiecție numai versurile. Numărul, colecția, structura, tonalitatea și celelalte taguri nu mai apar pe slide.
9. Zona Setări și administrare are acțiuni mai clare și o așezare compactă pe desktop și mobil.

## Aplicare pe baza existentă

1. Fă un backup complet din aplicație.
2. Oprește serverul local.
3. Extrage arhiva peste folderul actual `D:\Apps\song.app`. Păstrează fișierul `.env.local` existent.
4. În Supabase → SQL Editor rulează **o singură dată**:

   `supabase/updates/UPDATE-V80.sql`

`UPDATE-V80.sql` include v78, v79 și v80. **Nu rula separat `UPDATE-V78.sql` sau `UPDATE-V79.sql` și nu rula `INSTALL-NEW.sql` pe baza existentă.** SQL-ul păstrează momentele și programele; doar unifică stilul momentelor. Culoarea inițială este aleasă din culoarea folosită de cele mai multe momente existente și poate fi schimbată apoi din Colecții → Momente.

## Validare locală

```powershell
Set-Location "D:\Apps\song.app"
npm test
if ($LASTEXITCODE -eq 0) { npm run build }
if ($LASTEXITCODE -eq 0) { npm run local }
```

Nu este necesar `npm ci`: V80 nu adaugă dependențe. Nu face deploy încă.

## Verificare manuală recomandată

1. Deschide Colecții → Momente, schimbă culoarea și confirmă că se actualizează momentele dintr-un program și din linkul public.
2. Transformă o repetiție în program oficial, apoi transform-o înapoi.
3. Deschide programul public într-un al doilea browser, modifică o cântare și confirmă că rămâne cu chenar roșu până la **Am văzut**. Reîncarcă pagina înainte de confirmare și verifică faptul că marcajul rămâne.
4. În editorul unei cântări, schimbă Tip în Refren și verifică actualizarea automată a etichetei.
5. Schimbă colecția unei cântări și verifică numărul sugerat.
6. Setează numele administratorului în Administrare → Conturi și aprobări și verifică antetul unui program modificat.
7. Deschide Prezintă și confirmă că slide-urile cântărilor conțin numai versuri.

Validare automată: **105 teste** au trecut, build-ul Next.js a trecut, iar auditul dependențelor de producție raportează **0 vulnerabilități**.
