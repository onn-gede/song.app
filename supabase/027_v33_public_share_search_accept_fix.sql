-- v33: Fix acceptare propuneri publice + cautare publica dupa numar/text cu/fara diacritice.

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
  matched_source text,
  lyrics_text text
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
    select
      trim(coalesce(search_query, '')) as raw_term,
      lower(public.unaccent(trim(coalesce(search_query, '')))) as term,
      regexp_replace(lower(public.unaccent(trim(coalesce(search_query, '')))), '^nr\.?\s*', '', 'i') as number_term
  ), matches as (
    select
      s.id as song_id,
      s.title,
      s.default_key,
      s.bpm,
      s.lyrics_text,
      string_agg(distinct coalesce(sc.short_code || ' nr. ' || ss.song_number, sc.short_code, ss.source_title), ', ') as matched_source,
      greatest(
        case when lower(public.unaccent(s.title)) = q.term then 1.0 else 0.0 end,
        case when lower(public.unaccent(s.title)) like '%' || q.term || '%' then 0.85 else 0.0 end,
        case when s.search_text like '%' || q.term || '%' then 0.75 else 0.0 end,
        coalesce(similarity(s.search_text, q.term), 0),
        case when exists (
          select 1
          from public.song_sources ss2
          where ss2.song_id = s.id
            and (
              lower(public.unaccent(coalesce(ss2.song_number, ''))) like '%' || q.number_term || '%'
              or lower(public.unaccent(coalesce(ss2.source_title, ''))) like '%' || q.term || '%'
            )
        ) then 0.95 else 0.0 end
      )::real as rank
    from active_link
    cross join q
    join public.songs s on s.is_active = true
    left join public.song_sources ss on ss.song_id = s.id
    left join public.song_collections sc on sc.id = ss.collection_id
    where length(q.term) >= 2
      and (
        s.search_text like '%' || q.term || '%'
        or lower(public.unaccent(s.title)) like '%' || q.term || '%'
        or exists (
          select 1
          from public.song_sources ss3
          where ss3.song_id = s.id
            and (
              lower(public.unaccent(coalesce(ss3.song_number, ''))) like '%' || q.number_term || '%'
              or lower(public.unaccent(coalesce(ss3.source_title, ''))) like '%' || q.term || '%'
            )
        )
      )
    group by s.id, s.title, s.default_key, s.bpm, s.lyrics_text, s.search_text, q.term, q.number_term
  )
  select m.song_id, m.title, m.default_key, m.bpm, m.matched_source, m.lyrics_text
  from matches m
  order by m.rank desc, m.title asc
  limit least(greatest(result_limit, 1), 30);
$$;

grant execute on function public.public_search_songs_for_share(text, text, integer) to anon, authenticated;

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

notify pgrst, 'reload schema';
