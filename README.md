# SongApp BCBgiroc

Aplicație internă pentru biblioteca de cântări, pregătirea programelor, prezentare live, importuri, wishlisturi și integrarea locală cu FreeShow.

Versiunea surselor: **v105 / 0.34.0**. Validarea se face local; publicarea în Git și deploy-ul sunt pași separați și expliciți.

## Pornire locală

Păstrează `.env.local` în folderul proiectului, apoi rulează:

```powershell
Set-Location "D:\Apps\song.app"
npm ci
npm run build
npm run local
```

Deschide [http://localhost:3000](http://localhost:3000). Aplicația locală folosește aceeași bază Supabase configurată în `.env.local`; nu este un mod offline.

## Validare

```powershell
npm run validate
```

Comanda verifică lint, formatarea, TypeScript, testele de integrare și buildul. Testele de browser sunt separate:

```powershell
npx playwright install chromium
npm run test:e2e
```

## Structură

| Cale                   | Rol                                                                     |
| ---------------------- | ----------------------------------------------------------------------- |
| `app/`                 | rute Next.js, pagini și endpointuri                                     |
| `app/styles/`          | stiluri globale încărcate într-o ordine explicită                       |
| `components/`          | componente comune mai multor domenii                                    |
| `features/`            | logică, tipuri și componente grupate pe domeniu                         |
| `lib/`                 | infrastructură și utilitare partajate                                   |
| `legacy/`              | funcții păstrate pentru compatibilitate, nefolosite în fluxul principal |
| `supabase/migrations/` | sursa canonică a schemei, în ordine                                     |
| `supabase/updates/`    | actualizări incrementale pentru baze existente                          |
| `supabase/setup/`      | instalare completă pe o bază nouă                                       |
| `tests/integration/`   | verificări cu baza temporară PGlite                                     |
| `tests/e2e/`           | verificări de browser Playwright                                        |
| `docs/architecture/`   | limite, decizii și reguli tehnice                                       |
| `docs/releases/`       | note de versiune și arhiva instrucțiunilor vechi                        |

SQL-ul din rădăcină nu este canonic. Pentru o bază existentă se rulează numai fișierul cerut din `supabase/updates/`; pentru o bază nouă se folosește `supabase/setup/INSTALL-NEW.sql`.

## Comenzi utile

- `npm run dev` — dezvoltare cu recompilare automată.
- `npm run local` — rulare optimizată după build.
- `npm run lint` — reguli statice Next.js/React/TypeScript.
- `npm run format` — formatare automată.
- `npm run typecheck` — verificare TypeScript.
- `npm test` — teste unitare și de integrare fără baza reală.
- `npm run test:e2e` — verificări desktop și mobil în browser.
- `npm run sql:package` — regenerează pachetele SQL; nu modifică baza online.
- `npm run worker` — workerul extern vechi, păstrat separat în `legacy/`.

## Documentație

- [Arhitectură](docs/architecture/README.md)
- [Reguli pentru baza de date](docs/architecture/DATABASE.md)
- [Strategia de testare](docs/architecture/TESTING.md)
- [Lucru local](docs/guides/LUCRU-LOCAL.md)
- [Deploy Netlify](docs/deployment/NETLIFY-SETUP.md)
- [Validare v105](docs/validation/START-AICI-V105.md)

Fișierele istorice au fost mutate în `docs/history/` și `docs/releases/archive/`; nu trebuie folosite pentru o instalare curentă.
