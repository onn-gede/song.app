# Fix v4 - categorii și editare cântări

## Ce adaugă

- pagină nouă: `/categories`
- creare categorii tematice din interfață
- filtrare cântări după colecție și categorie pe `/songs`
- pagină de editare cântare: `/songs/[id]/edit`
- editare specificații: titlu, tonalitate, BPM, structură, note interne
- asociere cântare la una sau mai multe categorii
- linkuri rapide din detaliul cântării către filtrarea pe sursă/categorie
- card nou pe dashboard pentru numărul de categorii

## SQL necesar

Rulează în Supabase SQL Editor:

```sql
supabase/007_song_metadata_categories.sql
```

Ordinea completă, dacă instalezi de la zero:

```txt
001_init_schema.sql
002_seed_core_data.sql
003_make_first_admin.sql
004_seed_tineret_from_pptx.sql
005_app_helper_functions.sql
006_meeting_reorder_and_stability.sql
007_song_metadata_categories.sql
```

## După copiere

```bash
rmdir /s /q .next
npm run dev
```
