# SongApp v103 · 0.32.0

Arhiva este completă și cumulativă. Nu suprascrie `.env.local`.

## Ce este nou

- casetele secțiunilor din import se măresc automat până afișează tot textul, fără scrollbar intern;
- casetele rămân redimensionabile manual pe verticală;
- un rând liber desparte textul într-un calup nou care păstrează tipul și eticheta curentă (`Strofa 1` rămâne `Strofa 1`);
- butonul `+ Adaugă secțiune` creează în continuare o strofă nouă, cu următorul număr;
- wishlisturile sunt private implicit și pot fi publicate din pagina lor;
- publicarea generează un link separat `/wishlist/...`;
- vizitatorii pot vedea wishlistul și pot propune cântări;
- propunerile intră în așteptare și trebuie aprobate sau respinse de echipă;
- un wishlist poate reveni oricând la privat, iar linkul public nu mai oferă acces.

## Actualizarea bazei existente

În Supabase → SQL Editor rulează o singură dată fișierul:

`supabase/updates/UPDATE-V103.sql`

Fișierul este cumulativ peste v83: include wishlisturile v84, mutarea în program din v100 și funcțiile publice v103.

## Validare locală

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run build
npm run local
```

Verifică apoi:

1. import: adaugă un rând liber în `Strofa 1`; ambele calupuri trebuie să rămână `Strofa 1`;
2. redimensionează manual una dintre casete;
3. deschide un wishlist și apasă `Publică wishlistul`;
4. copiază linkul și deschide-l într-o fereastră privată;
5. propune o cântare;
6. revino autentificat, aprobă propunerea și verifică apariția ei în listă;
7. fă wishlistul privat și verifică faptul că linkul public nu mai afișează lista.
