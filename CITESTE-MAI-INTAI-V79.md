# SongApp v79 — 0.15.0

Pachet **cumulativ peste v77**. Include integral modificările v78 și v79. Nu instala v78 separat. Nu s-a făcut push/deploy și nu s-a executat SQL pe proiectul Supabase real.

## Ce conține

### Administrarea cântărilor și colecțiilor (inclus din v78)

1. O cântare poate fi ștearsă definitiv din Cântare → Editare, după confirmarea `STERGE`. Operația elimină înregistrarea și aparițiile ei din programe. Fă backup înainte: nu există anulare automată.
2. Numerele eliberate după instalarea acestui SQL, prin ștergere, renumerotare sau mutare, sunt refolosite înaintea unui număr nou. Este păstrat formatul, de exemplu `063`.
3. Colecția și numărul unei cântări pot fi schimbate din Editare → Colecții și numere. Un număr ocupat în colecția țintă este refuzat. Număr gol înseamnă alocare automată.
4. În Colecții există și secțiunea Momente, pentru titlu, observații și culoare.
5. Pe Acasă, programele recente sunt ordonate după data creării, cel mai nou primul.
6. Structura apare ca tag numai când are conținut; iconița mică de editare rămâne disponibilă editorilor.
7. Butonul Versuri este mic și se află în același rând cu tagurile programului.

### Programe, proiecție și LIVE (v79)

8. La creare poți alege **Program oficial** sau **Repetiție**. Tipul poate fi schimbat ulterior din Setări și administrare.
9. Cântările din repetiții nu intră în istoricul cântărilor, calendarul utilizărilor, „cântate recent” sau statisticile de frecvență. Schimbarea tipului recalculează imediat aceste rezultate; nu șterge programul.
10. O cântare poate fi creată numai cu titlu. Versurile sunt opționale la importul manual și pot fi completate ulterior din pagina cântării.
11. Butonul Prezintă deschide un selector de ecran. În browsere Chromium compatibile, pe HTTPS/localhost, poți alege direct un ecran conectat după acordarea permisiunii. În browsere fără această funcție se deschide o fereastră separată; pe Windows o poți muta cu `Win + Shift + săgeată`, apoi activezi Ecran complet din prezentare. Browserul trebuie să permită ferestre pop-up.
12. Pe pagina LIVE, elementele adăugate sau modificate primesc chenar roșu și îl păstrează până la apăsarea butonului **Am văzut**. Regula de 5 secunde a fost eliminată. Pagina internă de editare nu evidențiază propriile modificări. Pentru un element șters rămâne notificarea de actualizare, deoarece elementul nu mai există pentru a primi chenar.
13. Setări și administrare este reorganizată în carduri separate: tip program, șablon, duplicare și zonă de ștergere.
14. În antetul programului apar creatorul, data creării, ultimul utilizator care a modificat conținutul și data/ora modificării. Pentru programele vechi, SQL-ul poate păstra creatorul și ultima dată tehnică existentă, dar nu poate reconstrui identitatea exactă a modificărilor făcute înainte de v79. Modificările viitoare ale programului și ale elementelor sunt atribuite utilizatorului autentificat.
15. Tipul Oficial/Repetiție apare în lista programelor, Acasă, programul public, print și prezentare. Duplicarea păstrează tipul programului.

## Aplicare pe baza existentă

1. Fă un backup complet din aplicație și păstrează o copie a folderului actual.
2. Oprește serverul local.
3. Extrage arhiva peste `D:\Apps\song.app`. Păstrează fișierul `.env.local` existent.
4. În Supabase → SQL Editor rulează **o singură dată**:

   `supabase/updates/UPDATE-V79.sql`

`UPDATE-V79.sql` include atât v78, cât și v79. **Nu rula separat `UPDATE-V78.sql` și nu rula `INSTALL-NEW.sql` pe baza existentă.** Toate programele existente sunt inițial „Program oficial”. SQL-ul nu creează repetiții, nu șterge cântări și nu pornește vreun import.

Dacă proiectul Supabase este comun cu site-ul live, partea SQL devine activă și pentru live imediat ce o rulezi, chiar dacă nu faci deploy. Pentru izolare completă folosește o bază separată de test.

## Validare locală

După aplicarea SQL-ului în baza pe care ai ales-o:

```powershell
Set-Location "D:\Apps\song.app"
npm test
if ($LASTEXITCODE -eq 0) { npm run build }
if ($LASTEXITCODE -eq 0) { npm run local }
```

Nu sunt dependențe noi față de v77; dacă instalarea existentă funcționează, nu este obligatoriu `npm ci`. Nu face deploy încă.

## Verificare manuală recomandată

1. Creează o cântare numai cu titlu, apoi adaugă-i versurile ulterior.
2. Creează o repetiție cu o cântare și confirmă că nu apare în istoricul/statisticile acelei cântări.
3. Schimbă repetiția în program oficial și confirmă că programul apare în calendarul cântării.
4. Deschide linkul public într-un al doilea browser, modifică programul din administrare și verifică chenarul roșu până la **Am văzut**.
5. Conectează un al doilea ecran și testează Prezintă. Selectarea fizică a mai multor monitoare nu poate fi validată automat de testele aplicației.
6. Fă o modificare cu alt utilizator editor și verifică „Ultima modificare” în antet.

Validarea automată a pachetului: 92 teste de cod și bază de date au trecut, build-ul Next.js a trecut, iar auditul dependențelor de producție raportează 0 vulnerabilități.
