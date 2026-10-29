begin;
alter table public.meetings add column if not exists principal_responsible text;
alter table public.meetings add column if not exists secondary_responsibles text[] not null default '{}';
alter table public.meetings drop constraint if exists meeting_responsibles_length;
alter table public.meetings add constraint meeting_responsibles_length check (
  char_length(coalesce(principal_responsible,'')) <= 120 and cardinality(secondary_responsibles) <= 20
);

-- One atomic move for arrows, drag/drop, and transfer between lists.
-- Serialize per meeting; validate destination before writing any position.
create or replace function public.place_meeting_item_v45(
  p_meeting_id uuid, p_item_id uuid, p_is_backup boolean, p_before_id uuid default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare
  v_ids uuid[]; v_main uuid[]; v_backup uuid[]; v_target uuid[] := '{}';
  v_id uuid; v_index integer; v_min integer;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  perform 1 from public.meetings where id=p_meeting_id for update;
  if not found then raise exception 'Programul nu există.'; end if;
  if p_is_backup is null or not exists(select 1 from public.meeting_items where id=p_item_id and meeting_id=p_meeting_id) then
    raise exception 'Elementul nu există în acest program.';
  end if;
  if p_before_id=p_item_id then return true; end if;
  if p_before_id is not null and not exists(select 1 from public.meeting_items where id=p_before_id and meeting_id=p_meeting_id and is_backup=p_is_backup) then
    raise exception 'Poziția de destinație s-a schimbat. Încearcă din nou.';
  end if;
  select coalesce(array_agg(id order by position,id) filter(where not is_backup and id<>p_item_id),'{}'),
         coalesce(array_agg(id order by position,id) filter(where is_backup and id<>p_item_id),'{}'),
         least(coalesce(min(position),0),0)-count(*)::integer-1
    into v_main,v_backup,v_min from public.meeting_items where meeting_id=p_meeting_id;
  foreach v_id in array (case when p_is_backup then v_backup else v_main end) loop
    if v_id=p_before_id then v_target:=array_append(v_target,p_item_id); end if;
    v_target:=array_append(v_target,v_id);
  end loop;
  if p_before_id is null then v_target:=array_append(v_target,p_item_id); end if;
  if p_is_backup then v_backup:=v_target; else v_main:=v_target; end if;
  v_ids:=v_main||v_backup;
  v_index:=0;
  foreach v_id in array v_ids loop
    update public.meeting_items set position=v_min+v_index where id=v_id and meeting_id=p_meeting_id;
    v_index:=v_index+1;
  end loop;
  update public.meeting_items set is_backup=p_is_backup where id=p_item_id and meeting_id=p_meeting_id;
  v_index:=1;
  foreach v_id in array v_ids loop
    update public.meeting_items set position=v_index where id=v_id and meeting_id=p_meeting_id;
    v_index:=v_index+1;
  end loop;
  return true;
end $$;
revoke all on function public.place_meeting_item_v45(uuid,uuid,boolean,uuid) from public,anon;
grant execute on function public.place_meeting_item_v45(uuid,uuid,boolean,uuid) to authenticated;

-- Position allocation follows group membership, never a magic numeric threshold.
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

  perform 1 from public.meetings where id=p_meeting_id for update;
  select coalesce(max(position),0)+1 into v_position from public.meeting_items where meeting_id=p_meeting_id;

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

-- Position allocation follows group membership, never a magic numeric threshold.
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

  perform 1 from public.meetings where id=p_meeting_id for update;
  select coalesce(max(position),0)+1 into v_position from public.meeting_items where meeting_id=p_meeting_id;

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

create or replace function public.duplicate_meeting(p_meeting_id uuid,p_title text,p_meeting_date timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_meeting public.meetings;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  if nullif(trim(p_title),'') is null or p_meeting_date is null then raise exception 'Titlul și data sunt obligatorii.'; end if;
  select * into v_meeting from public.meetings where id=p_meeting_id for share;
  if not found then raise exception 'Programul nu există.'; end if;
  insert into public.meetings(title,meeting_type,meeting_date,notes,created_by,status,principal_responsible,secondary_responsibles) values(trim(p_title),v_meeting.meeting_type,p_meeting_date,v_meeting.notes,auth.uid(),'draft',v_meeting.principal_responsible,v_meeting.secondary_responsibles) returning id into v_id;
  insert into public.meeting_items(meeting_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name)
    select v_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name from public.meeting_items where meeting_id=p_meeting_id;
  return v_id;
end $$;

create or replace function public.get_shared_meeting(p_public_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'meeting', jsonb_build_object(
      'title', m.title,
      'meeting_type', m.meeting_type,
      'meeting_date', m.meeting_date,
      'notes', m.notes,
      'principal_responsible', m.principal_responsible,
      'secondary_responsibles', m.secondary_responsibles
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'position', mi.position,
          'item_type', mi.item_type,
          'is_backup', mi.is_backup,
          'custom_title', mi.custom_title,
          'custom_text', mi.custom_text,
          'selected_key', mi.selected_key,
          'selected_bpm', mi.selected_bpm,
          'notes', mi.notes,
          'responsible_name', mi.responsible_name,
          'song', case when s.id is null then null else jsonb_build_object(
            'title', s.title,
            'lyrics_text', s.lyrics_text,
            'default_key', s.default_key,
            'bpm', s.bpm,
            'structure', s.structure,
            'source_summary', (
              select string_agg(distinct coalesce(sc.short_code || ' nr. ' || ss.song_number, sc.short_code, ss.source_title), ', ' order by coalesce(sc.short_code || ' nr. ' || ss.song_number, sc.short_code, ss.source_title))
              from public.song_sources ss
              left join public.song_collections sc on sc.id = ss.collection_id
              where ss.song_id = s.id
                and coalesce(sc.short_code, ss.song_number, ss.source_title) is not null
            )
          ) end
        ) order by mi.position
      )
      from public.meeting_items mi
      left join public.songs s on s.id = mi.song_id
      where mi.meeting_id = m.id
    ), '[]'::jsonb),
    'contributions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'created_at', c.created_at,
          'reviewed_at', c.reviewed_at,
          'contribution_type', c.contribution_type,
          'status', c.status,
          'proposed_position', c.proposed_position,
          'is_backup', c.is_backup,
          'custom_title', c.custom_title,
          'custom_text', c.custom_text,
          'contributor_name', c.contributor_name,
          'notes', c.notes,
          'song', case when cs.id is null then null else jsonb_build_object(
            'title', cs.title,
            'lyrics_text', cs.lyrics_text,
            'default_key', cs.default_key,
            'bpm', cs.bpm,
            'structure', cs.structure,
            'source_summary', (
              select string_agg(distinct coalesce(sc.short_code || ' nr. ' || ss.song_number, sc.short_code, ss.source_title), ', ' order by coalesce(sc.short_code || ' nr. ' || ss.song_number, sc.short_code, ss.source_title))
              from public.song_sources ss
              left join public.song_collections sc on sc.id = ss.collection_id
              where ss.song_id = cs.id
                and coalesce(sc.short_code, ss.song_number, ss.source_title) is not null
            )
          ) end
        ) order by c.created_at asc
      )
      from public.public_meeting_contributions c
      left join public.songs cs on cs.id = c.song_id
      where c.meeting_id = m.id
        and c.status = 'pending'
    ), '[]'::jsonb),
    'contribution_history', coalesce((
      select jsonb_agg(row_data order by sort_date desc)
      from (
        select
          coalesce(c.reviewed_at, c.created_at) as sort_date,
          jsonb_build_object(
            'id', c.id,
            'created_at', c.created_at,
            'reviewed_at', c.reviewed_at,
            'contribution_type', c.contribution_type,
            'status', c.status,
            'proposed_position', c.proposed_position,
            'is_backup', c.is_backup,
            'custom_title', c.custom_title,
            'custom_text', c.custom_text,
            'contributor_name', c.contributor_name,
            'notes', c.notes,
            'song', case when cs.id is null then null else jsonb_build_object(
              'title', cs.title,
              'lyrics_text', cs.lyrics_text,
              'default_key', cs.default_key,
              'bpm', cs.bpm,
              'structure', cs.structure,
              'source_summary', (
                select string_agg(distinct coalesce(sc.short_code || ' nr. ' || ss.song_number, sc.short_code, ss.source_title), ', ' order by coalesce(sc.short_code || ' nr. ' || ss.song_number, sc.short_code, ss.source_title))
                from public.song_sources ss
                left join public.song_collections sc on sc.id = ss.collection_id
                where ss.song_id = cs.id
                  and coalesce(sc.short_code, ss.song_number, ss.source_title) is not null
              )
            ) end
          ) as row_data
        from public.public_meeting_contributions c
        left join public.songs cs on cs.id = c.song_id
        where c.meeting_id = m.id
        order by coalesce(c.reviewed_at, c.created_at) desc
        limit 20
      ) h
    ), '[]'::jsonb)
  )
  from public.meeting_share_links l
  join public.meetings m on m.id = l.meeting_id
  where l.public_slug = p_public_slug
    and l.is_active = true
    and (l.expires_at is null or l.expires_at > now())
  limit 1;
$$;
commit;
