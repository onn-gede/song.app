# SongApp v82 · pornește de aici

Arhiva este împărțită astfel:

- `01-INSTRUCTIUNI` – explicațiile versiunii și pașii de instalare;
- `02-APLICATIE` – proiectul complet, fără `node_modules`, `.next`, `.git` sau fișiere `.env` private;
- `MANIFEST-SHA256.txt` – lista fișierelor și amprentele lor pentru verificarea arhivei.

## Actualizarea instalării locale

1. Oprește SongApp dacă rulează.
2. Păstrează separat fișierul tău `D:\Apps\song.app\.env.local`.
3. Înlocuiește proiectul local cu conținutul folderului `02-APLICATIE`.
4. Pune înapoi `.env.local`; acesta nu este inclus în arhivă.
5. Rulează:

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run build
npm run local
```

Nu este necesară nicio comandă SQL pentru actualizarea FreeShow.

## Utilizare FreeShow

- Export cântare: deschide cântarea și apasă `FreeShow .show ↓`.
- Export program: deschide programul și apasă `FreeShow .show ↓`.
- Import: `Import → Din fișiere → Importă din FreeShow`.
- În FreeShow, fișierul descărcat se deschide din `File → Import → FreeShow`.
