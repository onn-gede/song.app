-- v38: Polish pentru share public editabil
-- - poziție propusă de user extern
-- - istoric contribuții
-- - acceptare la poziția propusă, cu reordonare sigură

alter table public.public_meeting_contributions
  add column if not exists proposed_position integer;

create index if not exists public_meeting_contributions_history_idx
  on public.public_meeting_contributions(meeting_id, status, reviewed_at desc, created_at desc);

create or replace function public.add_public_meeting_contribution(
  p_public_slug text,
  p_contribution_type text default 'song',
  p_song_id uuid default null,
  p_custom_title text default null,
  p_custom_text text default null,
  p_is_backup boolean default false,
  p_proposed_position integer default null,
  p_contributor_name text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
  v_id uuid;
  v_position integer;
begin
  select l.id as share_link_id, l.meeting_id
  into v_link
  from public.meeting_share_links l
  where l.public_slug = p_public_slug
    and l.is_active = true
    and (l.expires_at is null or l.expires_at > now())
  limit 1;

  if v_link.share_link_id is null then
    raise exception 'Linkul public nu este activ.';
  end if;

  p_contribution_type := coalesce(nullif(p_contribution_type, ''), 'song');
  if p_contribution_type not in ('song','text','prayer','encouragement','message','break') then
    raise exception 'Tip de contribuție invalid.';
  end if;

  if p_song_id is null and coalesce(trim(p_custom_title), '') = '' and coalesce(trim(p_custom_text), '') = '' then
    raise exception 'Adaugă o cântare sau completează un text.';
  end if;

  if p_song_id is not null and not exists (select 1 from public.songs s where s.id = p_song_id and s.is_active = true) then
    raise exception 'Cântarea selectată nu există.';
  end if;

  if p_proposed_position is not null then
    v_position := greatest(1, least(p_proposed_position, 999));
  else
    v_position := null;
  end if;

  insert into public.public_meeting_contributions (
    meeting_id,
    share_link_id,
    contribution_type,
    song_id,
    custom_title,
    custom_text,
    is_backup,
    proposed_position,
    contributor_name,
    notes,
    status
  ) values (
    v_link.meeting_id,
    v_link.share_link_id,
    p_contribution_type,
    p_song_id,
    nullif(left(trim(coalesce(p_custom_title, '')), 180), ''),
    nullif(left(trim(coalesce(p_custom_text, '')), 4000), ''),
    coalesce(p_is_backup, false),
    v_position,
    nullif(left(trim(coalesce(p_contributor_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_notes, '')), 1000), ''),
    'pending'
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_public_meeting_contribution(text, text, uuid, text, text, boolean, integer, text, text) to anon, authenticated;

create or replace function public.accept_public_meeting_contribution(p_contribution_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c record;
  v_position integer;
  v_max_position integer;
  v_base integer;
  v_item_id uuid;
  v_notes text;
  v_item_type public.meeting_item_type;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să accepți propuneri.';
  end if;

  select * into v_c
  from public.public_meeting_contributions
  where id = p_contribution_id
    and status = 'pending'
  for update;

  if v_c.id is null then
    raise exception 'Propunerea nu există sau a fost deja procesată.';
  end if;

  v_item_type := case
    when v_c.song_id is not null then 'song'::public.meeting_item_type
    when v_c.contribution_type in ('text','prayer','encouragement','message','break') then v_c.contribution_type::public.meeting_item_type
    else 'text'::public.meeting_item_type
  end;

  v_base := case when v_c.is_backup then 900 else 0 end;

  select coalesce(max(position), v_base)
  into v_max_position
  from public.meeting_items
  where meeting_id = v_c.meeting_id
    and is_backup = v_c.is_backup;

  if v_c.proposed_position is null then
    v_position := v_max_position + 1;
  else
    v_position := v_base + greatest(1, least(v_c.proposed_position, greatest(v_max_position - v_base + 1, 1)));
  end if;

  -- Facem loc pentru poziția propusă fără să riscăm coliziuni pe unique(meeting_id, position).
  update public.meeting_items
  set position = position + 10000
  where meeting_id = v_c.meeting_id
    and is_backup = v_c.is_backup
    and position >= v_position;

  update public.meeting_items
  set position = position - 9999
  where meeting_id = v_c.meeting_id
    and is_backup = v_c.is_backup
    and position >= v_position + 10000;

  v_notes := concat_ws(E'\n',
    nullif(v_c.notes, ''),
    'Adăugată din link public' || case when v_c.contributor_name is not null then ' de ' || v_c.contributor_name else '' end
  );

  insert into public.meeting_items (
    meeting_id,
    position,
    item_type,
    song_id,
    custom_title,
    custom_text,
    is_backup,
    notes
  ) values (
    v_c.meeting_id,
    v_position,
    v_item_type,
    v_c.song_id,
    v_c.custom_title,
    v_c.custom_text,
    v_c.is_backup,
    nullif(v_notes, '')
  ) returning id into v_item_id;

  update public.public_meeting_contributions
  set status = 'accepted', reviewed_at = now(), reviewed_by = auth.uid()
  where id = v_c.id;

  return v_item_id;
end;
$$;

grant execute on function public.accept_public_meeting_contribution(uuid) to authenticated;

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
      'notes', m.notes
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

grant execute on function public.get_shared_meeting(text) to anon, authenticated;
notify pgrst, 'reload schema';
