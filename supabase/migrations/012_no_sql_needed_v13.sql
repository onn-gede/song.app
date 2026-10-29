-- v13 nu necesită modificări de schemă.
-- Tabelele folosite există deja în schema inițială:
-- public.bible_references
-- public.song_bible_references

NOTIFY pgrst, 'reload schema';
