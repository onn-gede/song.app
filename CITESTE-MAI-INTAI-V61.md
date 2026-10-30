# SongApp v61 / 0.8.4 — patch după v60 sau v59.1

Închide aplicația locală cu Ctrl+C. Copiază conținutul arhivei peste D:\Apps\song.app. Păstrează .env.local, .git și local-assets. Include corecția v60 pentru tipurile momentelor. Nu necesită migrare SQL.

## Repararea buildului

    Set-Location "D:\Apps\song.app"
    npm ci
    npm run build

Pe Windows buildul utilizează implicit Webpack. Paginile private se randază explicit la cerere. Compilarea curăță .next înainte de rulare; pornirea verifică și manifestele, nu doar BUILD_ID. Buildul eșuat nu mai este considerat valid. Citirea PDF local este limitată explicit la directorul previzualizărilor pentru a evita urmărirea întregului proiect.

Continuă DOAR dacă buildul se termină fără eroare:

    npm run local

Nu rula în același timp un server local în altă fereastră în timpul compilării.

## Cele 92 încărcări incomplete

Rezultatul SQL confirmă toate cele 803 titluri și numere: 711 perechi confirmate, 92 incomplete. Nu trebuie șters sau recreat nimic. Cauza inițială a încărcărilor eșuate nu este cunoscută din aceste numere; raportul importatorului păstrează erorile.

În altă fereastră PowerShell sau după Ctrl+C:

    Set-Location "D:\Apps\song.app"
    npm run import:black-book

Se folosesc aceleași fișiere din local-assets: originals.zip și cele 803 PDF-uri. Se verifică toate identitățile, fără dubluri; perechile complete sunt verificate și omise, iar perechile incomplete sunt încărcate din nou. Nu sunt rescrise titlurile/versurile editate manual. Operațiunea nu depinde de serverul local pornit.

După import rulează din nou docs/verification/VERIFY-803-ONLINE.sql în Supabase. Așteptat: 803 complete, 0 incomplete. Acesta este un SELECT, nu o migrare.

Dacă rămân erori, trimite ultimul raport JSON indicat de comandă, din .songapp-imports/black-ppt-v58 (nu .env.local și nu chei). Nu repeta la nesfârșit importul dacă aceeași eroare persistă: raportul va arăta dacă este o limită de spațiu, acces sau altă cauză.

## Validare

Build Webpack de producție reușit în mediul Linux disponibil; pornire locală cu build complet reușită. Teste pentru refuzul buildului incomplet și alegerea Webpack pe Windows. Eroarea Windows Next.js nu a fost reprodusă direct în acest mediu; remedierea evită traseul Turbopack și prerandarea paginilor private. Nicio modificare pe live, nici push/deploy sau SQL automat.
