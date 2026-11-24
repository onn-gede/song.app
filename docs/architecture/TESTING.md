# Strategia de testare

## Niveluri

- **Static:** `npm run lint`, `npm run format:check`, `npm run typecheck`.
- **Unitate/contract:** fișierele `tests/*.test.ts` și testele `.mjs` pentru parsare/import.
- **Integrare DB:** `tests/integration/database.test.ts`, executat pe PGlite fără datele reale.
- **Browser:** `tests/e2e/`, executat pe desktop și profil mobil Chromium.
- **Build:** `npm run build`, inclus în `npm run validate`.

## Reguli

- Un bug reparat primește un test la nivelul cel mai apropiat de cauză.
- Testele nu folosesc proiectul Supabase de producție.
- Fluxurile critice publice, autentificarea și editarea programelor trebuie acoperite gradual în Playwright.
- Testul monolitic de bază rămâne momentan într-un folder de integrare; subtestele noi se adaugă în fișiere tematice când pot folosi un fixture comun.

În CI, validarea statică și testele aplicației rulează separat de jobul Playwright, astfel încât o problemă de browser să fie ușor de identificat.
