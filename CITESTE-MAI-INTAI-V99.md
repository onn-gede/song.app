# SongApp v99 · 0.28.0

Acest update nu necesită SQL nou.

## Noutăți

- indicator permanent **FreeShow Sync** deasupra utilizatorului;
- verde când conectorul local răspunde, roșu când este oprit sau indisponibil;
- explicație completă la hover sau focus;
- reverificare automată la 15 secunde și când revii în fereastra SongApp;
- exportul PPTX măsoară lățimea vizuală a textului înainte de generare;
- rândurile late și cuvintele foarte lungi sunt împărțite în siguranță;
- fiecare slide are maximum șase rânduri și este validat înainte de descărcare.

## Instalare locală

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run build
npm run local
```

Apasă `Ctrl+F5` după pornire. Conectorul deja instalat poate raporta starea activ/inactiv prin ruta `/health`. Varianta actualizată a conectorului este inclusă în descărcările aplicației.
