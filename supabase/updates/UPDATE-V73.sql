-- Pe aceeași bază, după v67. Nu importă și nu șterge date.
begin;
-- Shared link budgets, not a per-person identity mechanism or a DDoS protection.
create index if not exists contributions_link_created_v73 on public.public_meeting_contributions(share_link_id,created_at desc);
create index if not exists contributions_link_pending_v73 on public.public_meeting_contributions(share_link_id) where status='pending';
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
  if length(coalesce(p_public_slug,'')) not between 1 and 200
     or length(coalesce(p_contribution_type,'')) > 30
     or length(coalesce(p_custom_title,'')) > 180
     or length(coalesce(p_custom_text,'')) > 4000
     or length(coalesce(p_contributor_name,'')) > 120
     or length(coalesce(p_notes,'')) > 1000 then
    raise exception 'Propunerea depășește limitele: titlu 180, observații 4000, nume 120, notă 1000 caractere.' using errcode='22001';
  end if;
  select l.id as share_link_id, l.meeting_id
  into v_link
  from public.meeting_share_links l
  where l.public_slug = p_public_slug
    and l.is_active = true and l.allow_contributions
    and (l.expires_at is null or l.expires_at > now())
  limit 1;

  if v_link.share_link_id is null then
    raise exception 'Linkul public nu este activ.';
  end if;

  p_contribution_type := coalesce(nullif(p_contribution_type, ''), 'song');
  if p_contribution_type not in ('song','text','prayer','encouragement','message','break','other') then
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

  -- Serialize submissions for this link across every application instance.
  -- Do not trust a client supplied IP, cookie or contributor name as identity.
  perform 1 from public.meeting_share_links where id=v_link.share_link_id for update;
  -- Recheck after taking the lock: moderation may have disabled the link meanwhile.
  if not exists(select 1 from public.meeting_share_links where id=v_link.share_link_id
    and is_active and allow_contributions and (expires_at is null or expires_at>clock_timestamp())) then
    raise exception 'Linkul public nu este activ.';
  end if;
  select c.id into v_id from public.public_meeting_contributions c
  where c.share_link_id=v_link.share_link_id and c.status='pending'
    and c.created_at>clock_timestamp()-interval '30 seconds'
    and c.contribution_type=p_contribution_type
    and c.song_id is not distinct from p_song_id
    and c.custom_title is not distinct from nullif(trim(coalesce(p_custom_title,'')),'')
    and c.custom_text is not distinct from nullif(trim(coalesce(p_custom_text,'')),'')
    and c.contributor_name is not distinct from nullif(trim(coalesce(p_contributor_name,'')),'')
    and c.notes is not distinct from nullif(trim(coalesce(p_notes,'')),'')
    and c.is_backup=coalesce(p_is_backup,false)
    and c.proposed_position is not distinct from v_position
  order by c.created_at desc,c.id limit 1;
  if v_id is not null then return v_id;end if;
  if (select count(*) from public.public_meeting_contributions where share_link_id=v_link.share_link_id and created_at>clock_timestamp()-interval '1 minute')>=20
     or (select count(*) from public.public_meeting_contributions where share_link_id=v_link.share_link_id and created_at>clock_timestamp()-interval '1 hour')>=200 then
    raise exception 'S-au trimis multe propuneri pentru acest program. Încearcă din nou mai târziu.' using errcode='P0073';
  end if;
  if (select count(*) from public.public_meeting_contributions where share_link_id=v_link.share_link_id and status='pending')>=100 then
    raise exception 'Sunt multe propuneri în așteptare. Echipa trebuie să le verifice înainte de altele noi.' using errcode='P0073';
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

revoke all on function public.add_public_meeting_contribution(text,text,uuid,text,text,boolean,integer,text,text) from public;
grant execute on function public.add_public_meeting_contribution(text,text,uuid,text,text,boolean,integer,text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
