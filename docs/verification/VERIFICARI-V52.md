# Verificări v52 / 0.7.0 · validare locală

## Cerințe și implementare

| Cerință | Implementare |
|---|---|
| Culoare pentru fiecare colecție | Coloană persistentă, paletă inițială, editor de culoare în Colecții. Culoarea textului este ajustată pentru contrast când se alege o nuanță foarte deschisă. |
| Identitate în ordinea programului | Linie verticală lângă drag, titlu și număr în culoarea colecției; tonalitate, număr exact și nume colecție în etichete. |
| Cântare cu mai multe colecții | Sursa se alege la adăugare și poate fi schimbată în editor. Se păstrează după salvare, copiere și în linkul public. |
| Edit lângă solist și observații | Buton în aceeași zonă cu textul; salvare confirmată cu actualizare și închidere fără refresh. |
| Adaugă moment sus | Buton alăturat cu Adaugă cântări; formular modal pentru rugăciune/poezie/îndemn/mesaj/pauză. |
| Echipa și data | Bloc verde distinct pentru principal/secundari; data și ora mai mari lângă titlu. |
| Avertizări și calendar | Căutarea arată următoarea planificare/în curs și ultima utilizare trecută. Calendar modal cu cercuri roșii, selecția zilei și detalii exacte pe programe. |
| Stări după oră | În pregătire înainte de început; În curs pentru primele două ore; Finalizat de la două ore inclusiv. Actualizare locală la limitele de timp și la revenirea în tab, fără polling. |
| Mobil | Butoane și etichete rearanjate; calendar într-o coloană; fără depășire orizontală în scenariile testate. |

## Verificări automate

- 52 teste trecute, zero eșecuri. PostgreSQL PGlite pentru migrare și rerulare, instalare nouă, surse, culori, copiere, audit, RLS și share anonim.
- Cazul dimineață/seară: aceeași cântare în două programe din aceeași zi; căutarea exclude programul curent și semnalează întâlnirea de la 18:30.
- Calendarul deduplică aparițiile aceleiași cântări în același program, exclude șabloanele și folosește data din Europe/Bucharest.
- Viewer nu poate adăuga/modifica surse; conturile inactive și vizitatorii anonimi nu pot accesa căutarea/calendarul privat. Linkul public valid primește numai datele programului partajat.
- Verificate instantul de început, o milisecundă înainte de limita de două ore, limita exactă, trecerea peste miezul nopții, păstrarea stării de șablon/arhivat.
- Build de producție și TypeScript: trecute cu variabile fictive. Nicio credențială sau bază reală a utilizatorului nu a fost accesată.
- `npm ci --dry-run --ignore-scripts --no-audit --no-fund`: trecut; dependențele rămân cele existente.

## Verificare în browser

Chromium pe build de producție, cu sesiuni/date Supabase simulate, pentru alegerea colecției, culorile din căutare și program, păstrarea numărului 004, schimbarea sursei în editor, solist/observații fără refresh, moment din butonul de sus, echipă, avertizările datate, cercurile roșii și lista zilei, mobil la 390px și 320px (inclusiv limitele butoanelor din rând) și stările care se schimbă automat. Verificările includ lista Urmează / în curs, unde programul dispare automat la finalul celor două ore și se regăsește la Finalizate.

Aceste verificări nu reprezintă o testare pe baza reală a utilizatorului și nu măsoară latența proiectului Supabase real.

## Aplicare

1. În aceeași bază cu v49/v50/v51, rulează `supabase/updates/UPDATE-V52.sql`.
2. Actualizează sursele locale, păstrând .env.local și adresa http://localhost:3000.
3. Rulează npm ci, apoi npm run local.

Migrarea nu șterge cântări/programe. Asociază culori inițiale colecțiilor existente și adaugă funcții/câmpuri. Baza este comună aplicației locale și celei online; vechea versiune online poate ignora câmpurile noi. Pachetul rămâne pentru validare locală. Nu s-a făcut push, deploy sau modificare a setărilor Netlify.
