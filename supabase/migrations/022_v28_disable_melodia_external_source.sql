-- v28: dezactivează Melodia.ro din modulul de surse externe.
-- Nu șterge cântările deja importate; doar ascunde/dezactivează sursa pentru sincronizări noi.

update public.external_sources
set is_enabled = false,
    updated_at = now()
where slug = 'melodia';

notify pgrst, 'reload schema';
