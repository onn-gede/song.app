# SongApp v93 · wizard reparat și build EXE

- navigarea wizardului PowerShell folosește acum stare explicită și aduce pagina activă în față;
- scripturile PowerShell din ZIP sunt salvate cu UTF-8 BOM pentru afișarea corectă a diacriticelor în Windows PowerShell 5.1;
- proiectul include un installer Inno Setup real;
- GitHub Actions compilează installerul într-un singur fișier `SongApp-FreeShow-Connector-Setup.exe` pe Windows.

Până la compilarea EXE-ului, varianta ZIP reparată se pornește prin `SETUP-CONNECTOR.cmd`.
