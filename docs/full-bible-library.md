# v41 — Biblioteca biblică completă locală

Acest patch adaugă o bibliotecă biblică locală completă pentru limba română, folosind `ron-rccv.usfx.xml` din `seven1m/open-bibles`.

## Sursă recomandată

- `seven1m/open-bibles`
- Fișier: `ron-rccv.usfx.xml`
- Traducere: Protestant Romanian Corrected Cornilescu Version
- Licență indicată în repository: Public Domain

## Pași

1. Rulează în Supabase:

```sql
supabase/035_v41_full_bible_library.sql
```

2. Adaugă în `.env.local` cheia service role, doar local, fără să o urci în GitHub:

```env
SUPABASE_SERVICE_ROLE_KEY="..."
```

3. Rulează importul complet:

```bash
node scripts/import-romanian-bible-rccv.mjs
```

4. Verifică statistica:

```sql
select * from public.bible_library_stats();
```

Ținta este aproximativ:

- 66 cărți
- ~31.000 versete
- Vechiul + Noul Testament

## Test rapid

```sql
select * from public.search_bible_verses('cruce jertfa sange', 10);
select * from public.get_bible_reference_text('Ioan', 3, 16, null);
```

## Integrare sugestii

Fișierul `lib/bible/fullBibleSuggestions.ts` oferă helperul `getFullBibleSuggestionsForSong(...)`.
Acesta caută mai întâi teme în titlul cântării, apoi în versuri, și apoi caută versete în biblioteca locală completă.
