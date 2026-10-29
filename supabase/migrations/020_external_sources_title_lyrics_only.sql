-- v26: external sources title + lyrics only
-- This keeps the external source collections, but marks sync mode and descriptions as limited to title and lyrics.

update public.song_collections
set description = 'Colecție sincronizabilă din resursecrestine.ro. Import limitat la titlu și versuri.'
where short_code = 'RESURSE_CRESTINE';

update public.song_collections
set description = 'Colecție sincronizabilă din melodia.ro. Import limitat la titlu și versuri, pe baza permisiunii confirmate.'
where short_code = 'MELODIA_RO';

update public.external_sources
set sync_mode = 'title_lyrics_only',
    permission_notes = 'Sincronizare limitată la titlu și versuri.'
where slug = 'resursecrestine';

update public.external_sources
set sync_mode = 'title_lyrics_only',
    permission_notes = 'Sincronizare limitată la titlu și versuri, pe baza permisiunii confirmate de utilizator.'
where slug = 'melodia';

notify pgrst, 'reload schema';
