# SongApp v95 · conector EXE și export FreeShow

## Conector Windows

- GitHub Actions compilează installerul pe Windows;
- executabilul este publicat în GitHub Releases la tagul stabil `connector-latest`;
- pagina Administrare descarcă direct fișierul `.exe`;
- fereastra FreeShow local oferă același link;
- ZIP-ul cu `SETUP-CONNECTOR.cmd` rămâne numai ca variantă de rezervă.

## Export program

- elementele vechi cu `is_backup = null` sunt tratate ca elemente din lista principală;
- erorile de citire din baza de date nu mai sunt confundate cu lipsa versurilor;
- mesajul explică dacă respectivele cântări nu au versuri salvate în SongApp.
