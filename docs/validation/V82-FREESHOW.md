# SongApp v82 · FreeShow

Versiune: 0.17.0

## Funcționalități

- export individual al unei cântări în format FreeShow `.show`;
- exportul programului principal într-un singur fișier `.show`, în ordinea programului;
- import `.show` sau `.json` din FreeShow, cu preview înainte de salvare;
- păstrarea ordinii slide-urilor și a slide-urilor copil;
- identificarea secțiunilor Strofa, Refren, Pre-refren, Bridge și Final;
- preluarea tonalității, numărului și structurii, dacă există în metadatele FreeShow;
- limită de 5 MB și validarea conținutului importat;
- exporturile și importurile necesită autentificare; importul necesită rol de editor sau administrator.

## Unde se găsesc

- În pagina unei cântări: `FreeShow .show ↓`.
- În pagina unui program: `FreeShow .show ↓`.
- În `Import → Din fișiere`: `Importă din FreeShow (.show / .json)`.

## Validare

- build de producție reușit;
- TypeScript fără erori;
- 96 de teste automate trecute, inclusiv export → reimport FreeShow, ordinea slide-urilor și respingerea fișierelor invalide.

## Pornire locală

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run build
npm run local
```

Nu este necesară nicio migrare SQL pentru funcțiile FreeShow.
