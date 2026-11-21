SONGAPP - INSTALARE SI CONECTARE FREESHOW
=========================================

DESCARCARI SI DOCUMENTATIE
--------------------------
SongApp LIVE:
https://songappbcb.netlify.app

Conectorul SongApp pentru FreeShow:
https://songappbcb.netlify.app/downloads/SongApp-FreeShow-Connector-Windows.zip

FreeShow - descarcare oficiala:
https://freeshow.app/downloads

FreeShow - instalare pe Windows:
https://freeshow.app/docs/windows

Node.js LTS - descarcare oficiala (alege Windows Installer .msi):
https://nodejs.org/en/download/

Documentatia API FreeShow:
https://freeshow.app/api

Versiunile oficiale FreeShow pe GitHub:
https://github.com/ChurchApps/FreeShow/releases

INSTALARE RAPIDA
----------------
1. Instaleaza FreeShow.
2. Instaleaza Node.js LTS daca in PowerShell comanda "node --version" nu afiseaza o versiune.
3. Descarca si extrage conectorul intr-un folder stabil, de exemplu C:\SongApp-FreeShow-Connector.
4. Porneste FreeShow si activeaza Settings -> Connections -> API.
5. Ruleaza PORNESTE-CONNECTOR.cmd si lasa fereastra deschisa sau minimizata.
6. In SongApp deschide programul -> FreeShow local.
7. Foloseste adresa http://127.0.0.1:5510/freeshow.
8. Apasa "Sincronizeaza si creeaza programul".

REZULTAT
--------
- cantarile existente sunt reutilizate, fara duplicate noi;
- cantarile create anterior de SongApp primesc versurile actualizate;
- este creat sau actualizat un Project FreeShow cu titlul si data programului;
- ordinea Project-ului urmeaza ordinea programului SongApp;
- slide-urile contin numai versurile, fara titlu si fara etichete Strofa/Refren.

DIAGNOSTIC
----------
PowerShell:
Test-NetConnection 127.0.0.1 -Port 5510
Test-NetConnection 127.0.0.1 -Port 5506

Rezultatul corect este TcpTestSucceeded : True pentru ambele porturi.
