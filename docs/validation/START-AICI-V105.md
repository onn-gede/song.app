# Validare v105 — refactorizare tehnică

Versiunea nu cere SQL nou și nu schimbă intenționat funcționalitatea aplicației.

1. Extrage arhiva peste proiect și rulează `APLICA-REORGANIZAREA-V105.ps1` o singură dată.
2. Păstrează `.env.local` existent.
3. Rulează `npm ci`.
4. Rulează `npm run validate`.
5. Pornește cu `npm run local` și verifică login, un program, wishlistul, importul și prezentarea.
6. Opțional, rulează `npx playwright install chromium`, apoi `npm run test:e2e`.

Nu face push sau deploy până când validarea locală nu este completă.
