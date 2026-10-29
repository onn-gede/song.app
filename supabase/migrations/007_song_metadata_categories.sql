-- SongApp fix v4: administrare cântări + categorii
-- Rulează acest fișier după 006_meeting_reorder_and_stability.sql.

create or replace function public.slugify_ro(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(lower(public.unaccent(coalesce(p_value, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

grant execute on function public.slugify_ro(text) to authenticated;

create or replace function public.create_song_category(
  p_name text,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_base_slug text;
  v_slug text;
  v_id uuid;
  v_counter integer := 1;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să creezi categorii.';
  end if;

  v_name := nullif(trim(p_name), '');
  if v_name is null then
    raise exception 'Numele categoriei este obligatoriu.';
  end if;

  if p_parent_id is not null and not exists (select 1 from public.categories where id = p_parent_id) then
    raise exception 'Categoria părinte nu există.';
  end if;

  v_base_slug := public.slugify_ro(v_name);
  if length(v_base_slug) < 2 then
    v_base_slug := 'categorie';
  end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.categories where slug = v_slug) loop
    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter::text;
  end loop;

  insert into public.categories (name, slug, parent_id)
  values (v_name, v_slug, p_parent_id)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_song_category(text, uuid) to authenticated;

create or replace function public.update_song_metadata(
  p_song_id uuid,
  p_title text,
  p_default_key text default null,
  p_bpm integer default null,
  p_structure text default null,
  p_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să editezi cântări.';
  end if;

  v_title := nullif(trim(p_title), '');
  if v_title is null then
    raise exception 'Titlul cântării este obligatoriu.';
  end if;

  if p_bpm is not null and (p_bpm < 30 or p_bpm > 260) then
    raise exception 'BPM trebuie să fie între 30 și 260.';
  end if;

  update public.songs
  set
    title = v_title,
    default_key = nullif(trim(coalesce(p_default_key, '')), ''),
    bpm = p_bpm,
    structure = nullif(trim(coalesce(p_structure, '')), ''),
    notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_song_id;

  if not found then
    raise exception 'Cântarea nu există.';
  end if;

  return true;
end;
$$;

grant execute on function public.update_song_metadata(uuid, text, text, integer, text, text) to authenticated;

create or replace function public.set_song_categories(
  p_song_id uuid,
  p_category_ids uuid[] default array[]::uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să editezi categoriile cântării.';
  end if;

  if not exists (select 1 from public.songs where id = p_song_id) then
    raise exception 'Cântarea nu există.';
  end if;

  delete from public.song_categories
  where song_id = p_song_id;

  insert into public.song_categories (song_id, category_id)
  select p_song_id, category_id
  from unnest(coalesce(p_category_ids, array[]::uuid[])) as category_id
  where exists (select 1 from public.categories c where c.id = category_id)
  on conflict do nothing;

  return true;
end;
$$;

grant execute on function public.set_song_categories(uuid, uuid[]) to authenticated;

create or replace function public.get_category_song_counts()
returns table (
  category_id uuid,
  songs_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select category_id, count(*)::bigint as songs_count
  from public.song_categories
  group by category_id;
$$;

grant execute on function public.get_category_song_counts() to authenticated;
