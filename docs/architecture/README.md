# Arhitectura SongApp

SongApp folosește Next.js App Router și Supabase. Separarea urmărită este:

1. **Rute (`app/`)** — compun pagini și traduc cererile HTTP/formulare.
2. **Domenii (`features/`)** — tipuri, componente și operații specifice unei funcții.
3. **Componente comune (`components/`)** — UI reutilizat în mai multe domenii.
4. **Infrastructură (`lib/`)** — autentificare, Supabase, importuri și utilitare fără dependență de rută.
5. **Compatibilitate (`legacy/`)** — cod păstrat, dar exclus din fluxul principal.

Importurile noi trebuie să folosească aliasul `@/`. O rută poate apela un domeniu; un domeniu poate apela `lib/`; `lib/` nu trebuie să importe din `app/`.

## Convenții

- Operațiile server care modifică date verifică rolul prin `requireProfile`.
- Rutele publice nu folosesc cheia `service_role`.
- Numele SQL versionate rămân ascunse în stratul server al domeniului; UI-ul apelează funcții stabile.
- Tipurile de date ale unui domeniu sunt definite o singură dată în `features/<domeniu>/types.ts`.
- Fișierele vechi nu se copiază în rădăcină; instrucțiunile de release merg în `docs/releases/`.

Refactorizarea v105 aplică aceste limite domeniilor import, întâlniri, cântări și wishlist. Fișierele server mari rămân compatibile cu acțiunile existente și pot fi subdivizate ulterior în repository-uri mai mici fără schimbarea URL-urilor sau a contractelor SQL.
