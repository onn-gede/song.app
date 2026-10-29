-- SongApp MVP helpers
-- Rulează după 001, 002, 003 și după importul cântărilor.

create or replace function public.create_meeting(
  p_title text,
  p_meeting_type text default null,
  p_meeting_date timestamptz default now(),
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să creezi programe.';
  end if;

  insert into public.meetings (title, meeting_type, meeting_date, notes, created_by)
  values (p_title, p_meeting_type, p_meeting_date, p_notes, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_meeting(text, text, timestamptz, text) to authenticated;

create or replace function public.add_song_to_meeting(
  p_meeting_id uuid,
  p_song_id uuid,
  p_is_backup boolean default false,
  p_selected_key text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_position integer;
  v_song_key text;
  v_song_bpm integer;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  if not exists (select 1 from public.meetings where id = p_meeting_id) then
    raise exception 'Programul nu există.';
  end if;

  select default_key, bpm into v_song_key, v_song_bpm
  from public.songs
  where id = p_song_id and is_active = true;

  if p_is_backup then
    select coalesce(max(position), 900) + 1
      into v_position
    from public.meeting_items
    where meeting_id = p_meeting_id
      and position >= 900;
  else
    select coalesce(max(position), 0) + 1
      into v_position
    from public.meeting_items
    where meeting_id = p_meeting_id
      and position < 900;
  end if;

  insert into public.meeting_items (
    meeting_id,
    position,
    item_type,
    song_id,
    selected_key,
    selected_bpm,
    is_backup,
    notes
  )
  values (
    p_meeting_id,
    v_position,
    'song',
    p_song_id,
    coalesce(p_selected_key, v_song_key),
    v_song_bpm,
    p_is_backup,
    p_notes
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_song_to_meeting(uuid, uuid, boolean, text, text) to authenticated;

create or replace function public.add_text_to_meeting(
  p_meeting_id uuid,
  p_item_type text default 'text',
  p_custom_title text default null,
  p_custom_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_position integer;
  v_item_type public.meeting_item_type;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  v_item_type := case
    when p_item_type in ('song', 'prayer', 'message', 'encouragement', 'text', 'break') then p_item_type::public.meeting_item_type
    else 'text'::public.meeting_item_type
  end;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.meeting_items
  where meeting_id = p_meeting_id
    and position < 900;

  insert into public.meeting_items (
    meeting_id,
    position,
    item_type,
    custom_title,
    custom_text
  )
  values (
    p_meeting_id,
    v_position,
    v_item_type,
    p_custom_title,
    p_custom_text
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_text_to_meeting(uuid, text, text, text) to authenticated;

create or replace function public.create_meeting_share_link(
  p_meeting_id uuid,
  p_preferred_slug text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_slug text;
  v_base text;
  v_suffix text;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să creezi link public.';
  end if;

  select title into v_title from public.meetings where id = p_meeting_id;
  if v_title is null then
    raise exception 'Programul nu există.';
  end if;

  v_base := lower(public.unaccent(coalesce(nullif(p_preferred_slug, ''), v_title)));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if length(v_base) < 3 then
    v_base := 'program';
  end if;

  v_suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_slug := left(v_base, 70) || '-' || v_suffix;

  insert into public.meeting_share_links (meeting_id, public_slug, is_active, created_by)
  values (p_meeting_id, v_slug, true, auth.uid());

  return v_slug;
end;
$$;

grant execute on function public.create_meeting_share_link(uuid, text) to authenticated;

create or replace function public.remove_meeting_item(
  p_meeting_id uuid,
  p_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  delete from public.meeting_items
  where id = p_item_id
    and meeting_id = p_meeting_id;

  return true;
end;
$$;

grant execute on function public.remove_meeting_item(uuid, uuid) to authenticated;
