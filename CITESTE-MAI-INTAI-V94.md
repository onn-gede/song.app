# SongApp v94 · corecție scurtături Windows

Windows PowerShell 5.1 și componenta `WScript.Shell` pot refuza salvarea unei
scurtături `.lnk` dacă numele fișierului conține diacritice.

În v94, wizardul și mesajele păstrează diacriticele, dar scurtăturile folosesc
nume tehnice compatibile cu toate versiunile Windows:

- `Porneste conectorul`;
- `Opreste conectorul`;
- `Dezinstaleaza conectorul`.

Nu este necesară modificarea bazei de date sau a aplicației instalate local.
