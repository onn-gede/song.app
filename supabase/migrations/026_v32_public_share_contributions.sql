-- v32: Propuneri externe prin link public de share

create table if not exists public.public_meeting_contributions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  share_link_id uuid references public.meeting_share_links(id) on delete set null,
  contribution_type text not null default 'song' check (contribution_type in ('song','text','prayer','encouragement','message','break')),
  song_id uuid references public.songs(id) on delete set null,
  custom_title text,
  custom_text text,
  is_backup boolean not null default false,
  contributor_name text,
  notes text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint public_meeting_contribution_has_content check (
    (song_id is not null) or (coalesce(custom_title, '') <> '') or (coalesce(custom_text, '') <> '')
  )
);

create index if not exists public_meeting_contributions_meeting_idx on public.public_meeting_contributions(meeting_id, status, created_at);
create index if not exists public_meeting_contributions_song_idx on public.public_meeting_contributions(song_id);

alter table public.public_meeting_contributions enable row level security;

DO $$ BEGIN
  CREATE POLICY "public_contributions_read_auth" ON public.public_meeting_contributions
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "public_contributions_manage_editors" ON public.public_meeting_contributions
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

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
    'items', coalesce(jsonb_agg(
      distinct jsonb_build_object(
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
          'structure', s.structure
        ) end
      )
    ) filter (where mi.id is not null), '[]'::jsonb),
    'contributions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'created_at', c.created_at,
          'contribution_type', c.contribution_type,
          'status', c.status,
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
            'structure', cs.structure
          ) end
        ) order by c.created_at asc
      )
      from public.public_meeting_contributions c
      left join public.songs cs on cs.id = c.song_id
      where c.meeting_id = m.id
        and c.status = 'pending'
    ), '[]'::jsonb)
  )
  from public.meeting_share_links l
  join public.meetings m on m.id = l.meeting_id
  left join public.meeting_items mi on mi.meeting_id = m.id
  left join public.songs s on s.id = mi.song_id
  where l.public_slug = p_public_slug
    and l.is_active = true
    and (l.expires_at is null or l.expires_at > now())
  group by m.id, m.title, m.meeting_type, m.meeting_date, m.notes;
$$;

grant execute on function public.get_shared_meeting(text) to anon, authenticated;

create or replace function public.public_search_songs_for_share(
  p_public_slug text,
  search_query text,
  result_limit integer default 20
)
returns table (
  song_id uuid,
  title text,
  default_key text,
  bpm integer,
  matched_source text
)
language sql
stable
security definer
set search_path = public
as $$
  with active_link as (
    select l.id
    from public.meeting_share_links l
    where l.public_slug = p_public_slug
      and l.is_active = true
      and (l.expires_at is null or l.expires_at > now())
    limit 1
  ), q as (
    select trim(coalesce(search_query, '')) as term
  )
  select r.song_id, r.title, r.default_key, r.bpm, r.matched_source
  from active_link
  cross join q
  cross join lateral public.search_songs(q.term, least(greatest(result_limit, 1), 30)) r
  where length(q.term) >= 2;
$$;

grant execute on function public.public_search_songs_for_share(text, text, integer) to anon, authenticated;

create or replace function public.add_public_meeting_contribution(
  p_public_slug text,
  p_contribution_type text default 'song',
  p_song_id uuid default null,
  p_custom_title text default null,
  p_custom_text text default null,
  p_is_backup boolean default false,
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

  insert into public.public_meeting_contributions (
    meeting_id,
    share_link_id,
    contribution_type,
    song_id,
    custom_title,
    custom_text,
    is_backup,
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
    nullif(left(trim(coalesce(p_contributor_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_notes, '')), 1000), ''),
    'pending'
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_public_meeting_contribution(text, text, uuid, text, text, boolean, text, text) to anon, authenticated;

create or replace function public.accept_public_meeting_contribution(p_contribution_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c record;
  v_position integer;
  v_item_id uuid;
  v_notes text;
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

  select coalesce(max(position), case when v_c.is_backup then 900 else 0 end) + 1
  into v_position
  from public.meeting_items
  where meeting_id = v_c.meeting_id
    and is_backup = v_c.is_backup;

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
    v_c.contribution_type,
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

create or replace function public.reject_public_meeting_contribution(p_contribution_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să respingi propuneri.';
  end if;

  update public.public_meeting_contributions
  set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_contribution_id
    and status = 'pending';

  if not found then
    raise exception 'Propunerea nu există sau a fost deja procesată.';
  end if;

  return true;
end;
$$;

grant execute on function public.reject_public_meeting_contribution(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Re-definire mai stabilă: agregările sunt făcute în subquery-uri separate ca să evităm duplicatele din join-uri.
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
            'structure', s.structure
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
          'contribution_type', c.contribution_type,
          'status', c.status,
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
            'structure', cs.structure
          ) end
        ) order by c.created_at asc
      )
      from public.public_meeting_contributions c
      left join public.songs cs on cs.id = c.song_id
      where c.meeting_id = m.id
        and c.status = 'pending'
    ), '[]'::jsonb)
  )
  from public.meeting_share_links l
  join public.meetings m on m.id = l.meeting_id
  where l.public_slug = p_public_slug
    and l.is_active = true
    and (l.expires_at is null or l.expires_at > now())
  limit 1;
$$;

notify pgrst, 'reload schema';
