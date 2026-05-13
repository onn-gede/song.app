-- v30: instrumente pentru detectarea și unificarea cântărilor duplicate

create or replace function public.normalize_song_title_for_duplicates(p_title text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    regexp_replace(
      lower(public.unaccent(coalesce(p_title, ''))),
      '\\b(ale?luia|amin|cantare|cantec|imn)\\b',
      '',
      'g'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

create or replace function public.find_duplicate_song_candidates(p_limit integer default 50)
returns table (
  group_key text,
  title_hint text,
  song_count integer,
  songs jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      s.id,
      s.title,
      s.default_key,
      s.bpm,
      s.created_at,
      public.normalize_song_title_for_duplicates(s.title) as group_key,
      coalesce(string_agg(distinct c.name, ', ' order by c.name), '') as collections,
      coalesce(string_agg(distinct ss.song_number, ', ' order by ss.song_number) filter (where ss.song_number is not null and ss.song_number <> ''), '') as numbers,
      length(coalesce(s.lyrics_text, '')) as lyrics_length
    from public.songs s
    left join public.song_sources ss on ss.song_id = s.id
    left join public.song_collections c on c.id = ss.collection_id
    group by s.id
  ), grouped as (
    select
      n.group_key,
      min(n.title) as title_hint,
      count(*)::integer as song_count,
      jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'title', n.title,
          'default_key', n.default_key,
          'bpm', n.bpm,
          'created_at', n.created_at,
          'collections', n.collections,
          'numbers', n.numbers,
          'lyrics_length', n.lyrics_length
        ) order by n.lyrics_length desc, n.created_at asc
      ) as songs
    from normalized n
    where length(n.group_key) >= 4
    group by n.group_key
    having count(*) > 1
  )
  select g.group_key, g.title_hint, g.song_count, g.songs
  from grouped g
  order by g.song_count desc, g.title_hint asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

grant execute on function public.find_duplicate_song_candidates(integer) to authenticated;

create or replace function public.merge_duplicate_songs(p_primary_song_id uuid, p_duplicate_song_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duplicates uuid[];
  v_duplicate_count integer := 0;
  v_moved_meeting_items integer := 0;
  v_moved_files integer := 0;
  v_moved_external_refs integer := 0;
  v_moved_sources integer := 0;
  v_moved_categories integer := 0;
  v_moved_bible_refs integer := 0;
  v_deleted_songs integer := 0;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai drepturi pentru unificarea cântărilor.';
  end if;

  if p_primary_song_id is null then
    raise exception 'Lipsește cântarea principală.';
  end if;

  if not exists (select 1 from public.songs where id = p_primary_song_id) then
    raise exception 'Cântarea principală nu există.';
  end if;

  select coalesce(array_agg(distinct id), array[]::uuid[])
  into v_duplicates
  from unnest(coalesce(p_duplicate_song_ids, array[]::uuid[])) as id
  where id is not null
    and id <> p_primary_song_id
    and exists (select 1 from public.songs s where s.id = id);

  v_duplicate_count := coalesce(array_length(v_duplicates, 1), 0);

  if v_duplicate_count = 0 then
    return jsonb_build_object('merged', 0, 'message', 'Nu ai selectat duplicate de unificat.');
  end if;

  update public.meeting_items
  set song_id = p_primary_song_id
  where song_id = any(v_duplicates);
  get diagnostics v_moved_meeting_items = row_count;

  update public.song_files
  set song_id = p_primary_song_id
  where song_id = any(v_duplicates);
  get diagnostics v_moved_files = row_count;

  update public.external_song_refs
  set song_id = p_primary_song_id
  where song_id = any(v_duplicates);
  get diagnostics v_moved_external_refs = row_count;

  insert into public.song_categories (song_id, category_id)
  select distinct p_primary_song_id, sc.category_id
  from public.song_categories sc
  where sc.song_id = any(v_duplicates)
  on conflict do nothing;
  get diagnostics v_moved_categories = row_count;

  insert into public.song_bible_references (song_id, bible_reference_id, theme, reason, confidence, created_by)
  select distinct p_primary_song_id, sbr.bible_reference_id, sbr.theme, sbr.reason, sbr.confidence, sbr.created_by
  from public.song_bible_references sbr
  where sbr.song_id = any(v_duplicates)
  on conflict do nothing;
  get diagnostics v_moved_bible_refs = row_count;

  insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id, created_at)
  select distinct p_primary_song_id, ss.collection_id, ss.song_number, ss.source_title, ss.source_file_id, ss.created_at
  from public.song_sources ss
  where ss.song_id = any(v_duplicates)
  on conflict do nothing;
  get diagnostics v_moved_sources = row_count;

  delete from public.song_sources where song_id = any(v_duplicates);

  delete from public.songs where id = any(v_duplicates);
  get diagnostics v_deleted_songs = row_count;

  return jsonb_build_object(
    'merged', v_deleted_songs,
    'duplicate_count', v_duplicate_count,
    'moved_meeting_items', v_moved_meeting_items,
    'moved_files', v_moved_files,
    'moved_external_refs', v_moved_external_refs,
    'moved_sources', v_moved_sources,
    'moved_categories', v_moved_categories,
    'moved_bible_refs', v_moved_bible_refs,
    'message', 'Duplicatele selectate au fost unificate.'
  );
end;
$$;

grant execute on function public.merge_duplicate_songs(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
