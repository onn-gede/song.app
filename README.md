# SongApp BCBgiroc · v50 / 0.6.2

Căutare deschisă automat în programe goale, resetare și focalizare după adăugare, editor care se închide după salvare și tonalitate vizibilă în program și prezentare. Include toate funcțiile v49.

## Actualizare locală

1. Oprește aplicația și păstrează o copie a surselor și bazei.
2. Extrage arhiva peste folderul existent, păstrând `.env.local`.
3. Pentru trecerea v49 → v50 nu este necesar SQL nou. Dacă v49 nu a fost aplicat, rulează întâi UPDATE-V49.sql pe aceeași bază care are v48.
4. Adaugă în `.env.local` cheia privată `SUPABASE_SERVICE_ROLE_KEY` pentru crearea conturilor. Nu o pune în variabile NEXT_PUBLIC.
5. Rulează comenzile pe rând, continuând numai după succes:

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run build
npm run local
```

La prima încărcare după actualizare: Ctrl+F5. Conturile existente rămân active
conform stării lor; cele noi necesită aprobare. Dacă ai o versiune mai veche,
aplică întâi migrările intermediare. INSTALL-NEW.sql este numai pentru baze goale.

## Netlify

Urmează **NETLIFY-SETUP.md** pentru repository, variabile, Supabase Auth,
publicare și verificările de după deploy. Configurația este pregătită în pachet;
publicarea efectivă nu a fost executată din sesiunea de lucru fără acces de scriere.

## Utilizare

- Meniu desktop compact, fără scroll propriu la înălțimile uzuale; un singur scroll al documentului pentru liste lungi. Pe ecrane foarte joase/mobil meniul este un drawer separat.
- Pregătirea programului: rânduri compacte, backup sub lista principală pe orice ecran; căutarea și administrarea se deschid la cerere.
- Pagina publică are un format mai simplu, versuri expandabile, print și actualizare Live.
- Utilizatori: creare cont în așteptare, aprobare, roluri și mai mulți administratori. Ultimul admin activ este protejat.
- Contul meu: click pe numele utilizatorului pentru schimbarea parolei.
- Activitate: jurnal cu filtre și paginare, disponibil doar administratorilor.
- Linkurile de share se pot citi fără cont; biblioteca și administrarea sunt private. Propunerile externe se activează separat pe link.
- Workflow-ul zilnic verifică baza și actualizează heartbeat-ul la două zile, fără deploy-uri inutile. Trebuie activat în GitHub; nu este deja activ prin simpla descărcare a arhivei.

## Verificări

```powershell
npm test
npm run typecheck
npm run build
```

Detaliile sunt în VERIFICARI-V50.md. Workerul de sincronizare în calupuri rămâne oprit implicit.
