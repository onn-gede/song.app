# Validare v108 — program public, tonalități și sesiuni

## 1. SQL

În proiectul Supabase folosit de aplicație rulează o singură dată:

`supabase/updates/UPDATE-V108.sql`

Scriptul nu suprascrie tonalități existente. Completează numai valori lipsă identificate sigur după colecție, număr și titlu.

## 2. Pornire locală

```powershell
Set-Location "D:\Apps\SongApp-v108"
npm ci
npm run validate
npm run local
```

## 3. Verificări manuale

1. În antetul unui program, verifică butoanele pentru notificări, vizualizare publică, lacăt și meniu: trebuie să aibă aceeași înălțime și iconițe vizibile.
2. În pagina publică/live, verifică faptul că există un singur control „Versuri”.
3. Solistul și observațiile trebuie să apară pe același rând cu controlul de versuri, fără caseta veche cu simbolul de informații.
4. Structura trebuie afișată direct ca `S1, S2, R…`, fără prefixul „Structură:”.
5. În calendar, datele cu programe trebuie marcate printr-o linie colorată sub număr.
6. La o cântare fără tonalitate implicită, salvează tonalitatea dintr-un program. Redeschide cântarea și confirmă că tonalitatea a rămas salvată.
7. La o cântare care are deja tonalitate implicită, alege altă tonalitate numai pentru un program. Tonalitatea implicită nu trebuie suprascrisă.
8. Pentru verificarea sesiunii expirate, șterge/revocă sesiunea Supabase, apoi reîncarcă o pagină privată. Aplicația trebuie să curețe sesiunea veche și să trimită la autentificare.
