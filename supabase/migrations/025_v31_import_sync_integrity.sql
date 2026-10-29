-- v31: import/sync integrity helpers
-- Scop: importurile noi și sincronizările externe se salvează atomic în DB.
-- Dacă o etapă eșuează, nu rămân cântări parțiale fără secțiuni/sursă/import.

create or replace function public.import_song_with_sections(
  p_collection_id uuid,
  p_title text,
  p_song_number text,
  p_lyrics_text text,
  p_sections jsonb,
  p_file_name text,
  p_file_type text,
  p_parser_notes text,
  p_default_key text default null,
  p_bpm integer default null,
  p_structure text default null,
  p_notes text default null,
  p_storage_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_song_id uuid;
  v_file_id uuid;
  v_source_title text;
  v_file_type public.collection_source_type;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiuni pentru import.' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Titlul cântării este obligatoriu.';
  end if;

  if nullif(trim(coalesce(p_lyrics_text, '')), '') is null then
    raise exception 'Versurile cântării sunt obligatorii.';
  end if;

  if p_bpm is not null and (p_bpm < 30 or p_bpm > 260) then
    raise exception 'BPM trebuie să fie între 30 și 260.';
  end if;

  v_source_title := trim(p_title);

  begin
    v_file_type := coalesce(nullif(p_file_type, ''), 'other')::public.collection_source_type;
  exception when others then
    v_file_type := 'other'::public.collection_source_type;
  end;

  insert into public.songs (title, lyrics_text, default_key, bpm, structure, notes, is_active)
  values (v_source_title, p_lyrics_text, p_default_key, p_bpm, p_structure, p_notes, true)
  returning id into v_song_id;

  if coalesce(jsonb_array_length(coalesce(p_sections, '[]'::jsonb)), 0) > 0 then
    insert into public.song_sections (song_id, section_type, section_label, position, content)
    select
      v_song_id,
      coalesce(nullif(section_item->>'section_type', ''), 'verse'),
      nullif(section_item->>'section_label', ''),
      coalesce((section_item->>'position')::integer, row_number() over ())::integer,
      section_item->>'content'
    from jsonb_array_elements(p_sections) section_item
    where nullif(trim(coalesce(section_item->>'content', '')), '') is not null;
  end if;

  if not exists (select 1 from public.song_sections where song_id = v_song_id) then
    insert into public.song_sections (song_id, section_type, section_label, position, content)
    values (v_song_id, 'verse', 'Strofa 1', 1, p_lyrics_text);
  end if;

  insert into public.song_files (collection_id, song_id, file_name, file_type, storage_path, import_status, parsed_text, parser_notes)
  values (p_collection_id, v_song_id, coalesce(nullif(p_file_name, ''), v_source_title || '.txt'), v_file_type, p_storage_path, 'needs_review', p_lyrics_text, p_parser_notes)
  returning id into v_file_id;

  begin
    insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
    values (v_song_id, p_collection_id, nullif(p_song_number, ''), v_source_title, v_file_id);
  exception when unique_violation then
    insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
    values (
      v_song_id,
      p_collection_id,
      nullif(p_song_number, ''),
      v_source_title || ' (import ' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || ')',
      v_file_id
    );
  end;

  return v_song_id;
end;
$$;

create or replace function public.overwrite_song_with_sections(
  p_song_id uuid,
  p_collection_id uuid,
  p_title text,
  p_song_number text,
  p_lyrics_text text,
  p_sections jsonb,
  p_file_name text,
  p_file_type text,
  p_parser_notes text,
  p_default_key text default null,
  p_bpm integer default null,
  p_structure text default null,
  p_notes text default null,
  p_storage_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file_id uuid;
  v_source_id uuid;
  v_source_title text;
  v_file_type public.collection_source_type;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiuni pentru suprascriere import.' using errcode = '42501';
  end if;

  if p_song_id is null then
    raise exception 'Lipsește cântarea țintă pentru suprascriere.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Titlul cântării este obligatoriu.';
  end if;

  if nullif(trim(coalesce(p_lyrics_text, '')), '') is null then
    raise exception 'Versurile cântării sunt obligatorii.';
  end if;

  if p_bpm is not null and (p_bpm < 30 or p_bpm > 260) then
    raise exception 'BPM trebuie să fie între 30 și 260.';
  end if;

  v_source_title := trim(p_title);

  begin
    v_file_type := coalesce(nullif(p_file_type, ''), 'other')::public.collection_source_type;
  exception when others then
    v_file_type := 'other'::public.collection_source_type;
  end;

  update public.songs
  set title = v_source_title,
      lyrics_text = p_lyrics_text,
      default_key = p_default_key,
      bpm = p_bpm,
      structure = p_structure,
      notes = p_notes,
      is_active = true
  where id = p_song_id;

  if not found then
    raise exception 'Cântarea țintă nu există.';
  end if;

  delete from public.song_sections where song_id = p_song_id;

  if coalesce(jsonb_array_length(coalesce(p_sections, '[]'::jsonb)), 0) > 0 then
    insert into public.song_sections (song_id, section_type, section_label, position, content)
    select
      p_song_id,
      coalesce(nullif(section_item->>'section_type', ''), 'verse'),
      nullif(section_item->>'section_label', ''),
      coalesce((section_item->>'position')::integer, row_number() over ())::integer,
      section_item->>'content'
    from jsonb_array_elements(p_sections) section_item
    where nullif(trim(coalesce(section_item->>'content', '')), '') is not null;
  end if;

  if not exists (select 1 from public.song_sections where song_id = p_song_id) then
    insert into public.song_sections (song_id, section_type, section_label, position, content)
    values (p_song_id, 'verse', 'Strofa 1', 1, p_lyrics_text);
  end if;

  insert into public.song_files (collection_id, song_id, file_name, file_type, storage_path, import_status, parsed_text, parser_notes)
  values (p_collection_id, p_song_id, coalesce(nullif(p_file_name, ''), v_source_title || '.txt'), v_file_type, p_storage_path, 'needs_review', p_lyrics_text, p_parser_notes)
  returning id into v_file_id;

  select id into v_source_id
  from public.song_sources
  where collection_id = p_collection_id
    and source_title = v_source_title
    and (song_number is not distinct from nullif(p_song_number, ''))
  limit 1;

  if v_source_id is not null then
    update public.song_sources
    set song_id = p_song_id,
        source_file_id = v_file_id
    where id = v_source_id;

    delete from public.song_sources
    where song_id = p_song_id
      and collection_id = p_collection_id
      and id <> v_source_id;
  else
    select id into v_source_id
    from public.song_sources
    where song_id = p_song_id
      and collection_id = p_collection_id
    limit 1;

    if v_source_id is not null then
      update public.song_sources
      set song_number = nullif(p_song_number, ''),
          source_title = v_source_title,
          source_file_id = v_file_id
      where id = v_source_id;
    else
      insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
      values (p_song_id, p_collection_id, nullif(p_song_number, ''), v_source_title, v_file_id);
    end if;
  end if;

  return p_song_id;
end;
$$;

create or replace function public.upsert_external_song_title_lyrics(
  p_external_source_id uuid,
  p_collection_id uuid,
  p_external_id text,
  p_external_url text,
  p_title text,
  p_lyrics_text text,
  p_sections jsonb,
  p_content_hash text,
  p_overwrite boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref record;
  v_song_id uuid;
  v_result text := 'imported';
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiuni pentru sincronizare externă.' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Titlul cântării externe este obligatoriu.';
  end if;

  if nullif(trim(coalesce(p_lyrics_text, '')), '') is null then
    raise exception 'Versurile cântării externe sunt obligatorii.';
  end if;

  select * into v_ref
  from public.external_song_refs
  where external_source_id = p_external_source_id
    and external_id = p_external_id
  limit 1;

  if v_ref.id is not null and v_ref.song_id is not null and v_ref.content_hash = p_content_hash and not p_overwrite then
    update public.external_song_refs
    set last_seen_at = now(),
        sync_status = 'skipped'
    where id = v_ref.id;
    return 'skipped';
  end if;

  if v_ref.song_id is not null then
    v_song_id := v_ref.song_id;
    v_result := 'updated';

    update public.songs
    set title = p_title,
        lyrics_text = p_lyrics_text,
        is_active = true
    where id = v_song_id;

    delete from public.song_sections where song_id = v_song_id;
  else
    insert into public.songs (title, lyrics_text, is_active)
    values (p_title, p_lyrics_text, true)
    returning id into v_song_id;

    v_result := 'imported';
  end if;

  if coalesce(jsonb_array_length(coalesce(p_sections, '[]'::jsonb)), 0) > 0 then
    insert into public.song_sections (song_id, section_type, section_label, position, content)
    select
      v_song_id,
      coalesce(nullif(section_item->>'section_type', ''), 'verse'),
      nullif(section_item->>'section_label', ''),
      coalesce((section_item->>'position')::integer, row_number() over ())::integer,
      section_item->>'content'
    from jsonb_array_elements(p_sections) section_item
    where nullif(trim(coalesce(section_item->>'content', '')), '') is not null;
  end if;

  if not exists (select 1 from public.song_sections where song_id = v_song_id) then
    insert into public.song_sections (song_id, section_type, section_label, position, content)
    values (v_song_id, 'verse', 'Strofa 1', 1, p_lyrics_text);
  end if;

  if not exists (
    select 1 from public.song_sources
    where song_id = v_song_id
      and collection_id = p_collection_id
  ) then
    insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
    values (v_song_id, p_collection_id, null, p_title, null);
  end if;

  if v_ref.id is not null then
    update public.external_song_refs
    set song_id = v_song_id,
        collection_id = p_collection_id,
        external_url = p_external_url,
        external_title = p_title,
        external_author = null,
        external_number = null,
        import_mode = 'title_lyrics_only',
        sync_status = v_result,
        content_hash = p_content_hash,
        last_seen_at = now(),
        last_imported_at = now()
    where id = v_ref.id;
  else
    insert into public.external_song_refs (
      external_source_id, song_id, collection_id, external_id, external_url, external_title,
      external_author, external_number, import_mode, sync_status, content_hash, last_seen_at, last_imported_at
    )
    values (
      p_external_source_id, v_song_id, p_collection_id, p_external_id, p_external_url, p_title,
      null, null, 'title_lyrics_only', v_result, p_content_hash, now(), now()
    );
  end if;

  return v_result;
end;
$$;

grant execute on function public.import_song_with_sections(uuid, text, text, text, jsonb, text, text, text, text, integer, text, text, text) to authenticated;
grant execute on function public.overwrite_song_with_sections(uuid, uuid, text, text, text, jsonb, text, text, text, text, integer, text, text, text) to authenticated;
grant execute on function public.upsert_external_song_title_lyrics(uuid, uuid, text, text, text, text, jsonb, text, boolean) to authenticated;

notify pgrst, 'reload schema';

create or replace function public.import_sync_integrity_report()
returns table(check_name text, issue_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select 'song_files_without_song'::text, count(*)::integer from public.song_files where song_id is null
  union all
  select 'song_files_without_collection'::text, count(*)::integer from public.song_files where collection_id is null
  union all
  select 'imported_songs_without_sections'::text, count(distinct sf.song_id)::integer
    from public.song_files sf
    left join public.song_sections ss on ss.song_id = sf.song_id
    where sf.song_id is not null and ss.id is null
  union all
  select 'imported_songs_without_source'::text, count(distinct sf.song_id)::integer
    from public.song_files sf
    left join public.song_sources src on src.song_id = sf.song_id
    where sf.song_id is not null and src.id is null
  union all
  select 'external_refs_without_song'::text, count(*)::integer from public.external_song_refs where song_id is null
  union all
  select 'external_songs_without_sections'::text, count(distinct er.song_id)::integer
    from public.external_song_refs er
    left join public.song_sections ss on ss.song_id = er.song_id
    where er.song_id is not null and ss.id is null
  union all
  select 'external_songs_without_source'::text, count(distinct er.song_id)::integer
    from public.external_song_refs er
    left join public.song_sources src on src.song_id = er.song_id and src.collection_id = er.collection_id
    where er.song_id is not null and src.id is null
  union all
  select 'stale_running_sync_runs'::text, count(*)::integer
    from public.external_sync_runs
    where status = 'running' and started_at < now() - interval '2 hours';
$$;

grant execute on function public.import_sync_integrity_report() to authenticated;

notify pgrst, 'reload schema';
