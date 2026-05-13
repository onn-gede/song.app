-- v29: control mai bun pentru sursele externe / curățare importuri Resurse Creștine

create or replace function public.delete_external_source_songs(p_source_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_id uuid;
  v_song_ids uuid[];
  v_deleted_refs integer := 0;
  v_deleted_songs integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Doar administratorii pot șterge importurile unei surse externe.';
  end if;

  select id into v_source_id
  from public.external_sources
  where slug = p_source_slug
  limit 1;

  if v_source_id is null then
    return jsonb_build_object('deleted_refs', 0, 'deleted_songs', 0, 'message', 'Sursa nu există.');
  end if;

  select coalesce(array_agg(distinct song_id) filter (where song_id is not null), array[]::uuid[])
  into v_song_ids
  from public.external_song_refs
  where external_source_id = v_source_id;

  delete from public.external_song_refs
  where external_source_id = v_source_id;
  get diagnostics v_deleted_refs = row_count;

  if array_length(v_song_ids, 1) is not null then
    delete from public.songs
    where id = any(v_song_ids);
    get diagnostics v_deleted_songs = row_count;
  end if;

  update public.external_sources
  set last_synced_at = null
  where id = v_source_id;

  return jsonb_build_object(
    'deleted_refs', v_deleted_refs,
    'deleted_songs', v_deleted_songs,
    'message', 'Importul extern a fost șters.'
  );
end;
$$;

grant execute on function public.delete_external_source_songs(text) to authenticated;

notify pgrst, 'reload schema';
