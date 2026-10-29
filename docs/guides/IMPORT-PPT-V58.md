# SongApp v58 / 0.8.0 — Cartea Neagră din PPT

## Ce conține pachetul

- Catalogul celor 803 PPT-uri originale, numerotate 001–803. Pentru fișierele sursă se reutilizează arhiva ta originală, copiată în `local-assets/black-book/originals.zip`.
- 803 previzualizări PDF, în total 4414 slide-uri, convertite din prezentările primite. Fișierele originale sunt nemodificate.
- Catalogul titlurilor și numerelor: `docs/catalogs/CARTEA-NEAGRA-PPT.md`.
- Importator local și încărcare din pagina Import, fără obligativitatea versurilor.
- Vizualizator în aplicație: săgeți, taste stânga/dreapta, Home/End și ecran complet. PPT-ul original se poate descărca separat, fără deschiderea unui tab nou pentru descărcare.

Fișierele 804 și 805 nu există în arhiva primită. Importăm cele 803 disponibile; nu fabricăm titluri și nu condiționăm importul de 805. Previzualizarea PDF este statică; originalul PPT păstrează conținutul și efectele originale.

Există două perechi de titluri repetate, la numere diferite: 230/623 („O, frate, ce eşti aşa trist?”) și 509/663 („Stii tu numarul de stele”). Sunt păstrate toate cele 803 poziții și fișiere originale; nu au fost unificate automat.

## Actualizare și import recomandat

1. Oprește aplicația locală (Ctrl+C). Extrage arhiva v58 într-un folder nou, de exemplu `D:\Apps\SongApp-local`. Păstrează vechiul folder și copiază fișierul `.env.local` existent în folderul nou. Pentru rularea locală, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`; configurația Supabase rămâne aceeași.
2. În SQL Editor din același proiect Supabase rulează `supabase/updates/UPDATE-V58.sql`, după v57 sau v57.1. Include protecția v57.1. SQL-ul nu importă, nu arhivează și nu dezactivează cântece.
3. Rulează comenzile pe rând și continuă după succes:

```powershell
Set-Location "D:\Apps\SongApp-local"
npm ci
npm run import:black-book
npm run build
npm run local
```

Previzualizările sunt incluse în `local-assets/black-book/previews`. Copiază arhiva PPT originală, nemodificată, în `local-assets/black-book/originals.zip`. Nu trebuie să extragi PPT-urile și nu trebuie instalat LibreOffice. Comanda verifică toate amprentele fișierelor înainte de conectare la Supabase.

Dacă cheia privată service role nu este completată în `.env.local`, consola cere local emailul și parola unui cont SongApp cu drept de editare. Parola nu se afișează și nu se salvează. Datele de acces rămân în configurația locală.

## Destinație și păstrarea datelor

Implicit, comanda creează/reutilizează **Cartea Neagră - Cântările Evangheliei · PPT**. Este distinctă de vechea colecție provenită din API, deoarece numerotarea și edițiile pot diferi. Celelalte colecții, versurile existente, tonalitățile, notele și programele rămân păstrate. Colecția PPT poate fi redenumită sau recolorată; reluarea importului o identifică stabil și după redenumire.

Pentru o colecție existentă poți folosi selectorul din pagina Import sau, în consola locală, `npm run import:black-book -- --collection ID-COLECTIE`. Numerele care există deja cu alt titlu sunt oprite pentru verificare; nu sunt înlocuite automat. Nu trebuie folosit `npm run import:books` pentru arhiva PPT — acela este vechiul importator API, protejat împotriva catalogului CN parțial.

Importatorul înregistrează întâi toate titlurile, apoi încarcă originalele și PDF-urile în bucket-ul privat `song-files`. Un fișier nu apare ca disponibil până la confirmarea ambelor încărcări. Cântările pot fi căutate și adăugate în programe fără versuri. Fișierele sunt accesibile utilizatorilor autentificați cu cont activ; nu devin publice automat printr-un link de program.

## Întrerupere și reluare

Rulează aceeași comandă după o întrerupere. Numărul în colecție identifică aceeași înregistrare; reîncercarea nu dublează cântecele sau atașamentele. Titlurile editate local, versurile și tonalitățile nu sunt suprascrise. Fișierele deja confirmate sunt verificate și nu sunt reîncărcate inutil. Raportul este în `.songapp-imports/black-ppt-v58/raport-*.json`.

Pentru verificare fără conectare/scriere în Supabase:

```powershell
npm run import:black-book -- --prepare-only
```

## Din interfața aplicației

În **Import → Din fișiere → Prezentări PPT / PPTX — titluri și fișiere**, poți selecta PPT/PPTX sau un ZIP, alege colecția și corecta numerele/titlurile înainte de import. Versurile nu sunt obligatorii. Pentru fișierele din arhiva inclusă, aplicația locală recunoaște originalul și adaugă automat PDF-ul pregătit. Alte prezentări pot avea un PDF cu același număr în lot; fără acesta originalul rămâne descărcabil, iar PDF-ul poate fi adăugat ulterior.

În cântare: **Vezi prezentarea** deschide vizualizatorul, iar **Descarcă PPT/PPTX** descarcă originalul. Pentru cântecele fără versuri, butonul obișnuit **Prezintă** deschide previzualizarea disponibilă. Programul textual nu este convertit automat într-un singur deck de PowerPoint; atașamentele se deschid din fiecare cântare.

Fișierele mari din `local-assets` sunt excluse din Git și din pachetul funcțiilor Netlify. După import, prezentările sunt servite din stocarea privată Supabase; aplicația găzduită nu are nevoie de arhiva locală. Nu s-a făcut push sau deploy.
