# SongApp v100 · 0.29.0

## Înainte de pornire

Rulează o singură dată în Supabase SQL Editor:

`supabase/updates/UPDATE-V100.sql`

Acest update nu șterge cântări, programe sau wishlisturi. Adaugă mutarea atomică a unei cântări din wishlist într-un program activ/viitor.

## Noutăți

- „Playlist” a devenit **Wishlist** în interfață;
- o cântare din wishlist poate fi mutată în lista principală sau în backupul unui program activ/viitor;
- strofele lungi sunt distribuite echilibrat între slide-urile PPTX (de exemplu 7 rânduri devin 4 + 3);
- importul din link acceptă pagini publice HTML și fișiere text și elimină etichetele Strofa/Refren/Bridge etc.;
- site-urile cu structură uzuală de versuri și paginile cu secțiuni marcate sunt detectate generic;
- colecția de tineri primește sugestii YouTube cu confirmare, atât la adăugare, cât și la editarea cântărilor existente;
- fără cheia YouTube configurată, este disponibil linkul direct către căutarea YouTube.

## Sugestii YouTube automate (opțional)

Adaugă variabila privată `YOUTUBE_DATA_API_KEY` în `.env.local` pentru rulare locală și în mediul de hosting pentru varianta live. Nu folosi prefixul `NEXT_PUBLIC_`; cheia trebuie să rămână pe server.

## Pornire locală

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run build
npm run local
```
