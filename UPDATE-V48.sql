-- ACTUALIZARE v47/v47.1 → v48 pe ACELAȘI proiect Supabase.
begin;
alter table public.profiles alter column is_active set default false;
create table if not exists public.activity_log_v48 (
 id bigint generated always as identity primary key, occurred_at timestamptz not null default now(),
 actor_id uuid, actor_email text, event_type text not null, resource_type text, resource_id text,
 path text, details jsonb not null default '{}', transaction_id bigint not null default txid_current()
);
create index if not exists activity_log_date_v48 on public.activity_log_v48(occurred_at desc,id desc);
create index if not exists activity_log_actor_v48 on public.activity_log_v48(actor_id,occurred_at desc);
alter table public.activity_log_v48 enable row level security;
drop policy if exists activity_admin_read on public.activity_log_v48;
create policy activity_admin_read on public.activity_log_v48 for select to authenticated using(public.is_admin());
revoke all on public.activity_log_v48 from public,anon,authenticated;
grant select on public.activity_log_v48 to authenticated;
grant insert,select on public.activity_log_v48 to service_role;
grant usage,select on sequence public.activity_log_v48_id_seq to service_role;

create or replace function public.audit_write_v48() returns trigger language plpgsql security definer set search_path=public as $$
declare v_old jsonb;v_new jsonb;v_row jsonb;v_fields jsonb;v_before jsonb;v_after jsonb;
begin
 v_old:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 v_new:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 v_row:=case when tg_op='DELETE' then v_old else v_new end;
 select coalesce(jsonb_agg(key order by key),'[]') into v_fields from (select key from jsonb_each(v_old||v_new) where (v_old->key) is distinct from (v_new->key)) x;
 -- Never copy credentials, full lyrics, notes, tokens or share slugs into audit data.
 select coalesce(jsonb_object_agg(key,value),'{}') into v_before from jsonb_each(v_old) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions']);
 select coalesce(jsonb_object_agg(key,value),'{}') into v_after from jsonb_each(v_new) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions']);
 insert into public.activity_log_v48(actor_id,actor_email,event_type,resource_type,resource_id,details)
 values(auth.uid(),(select email from public.profiles where id=auth.uid()),lower(tg_op),tg_table_name,coalesce(v_row->>'id',v_row->>'song_id',v_row->>'source_key'),jsonb_build_object('fields',v_fields,'before',v_before,'after',v_after));
 return null;
end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','songs','song_sections','song_sources','song_files','song_collections','categories','song_categories','meetings','meeting_items','meeting_share_links','song_bible_references','public_meeting_contributions','external_sources','external_song_refs','external_sync_runs','song_link_imports','youth_key_applied_v46','song_merge_history_v47'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop trigger if exists audit_write_v48 on public.%I',t);
   execute format('create trigger audit_write_v48 after insert or update or delete on public.%I for each row execute function public.audit_write_v48()',t);
  end if;
 end loop;
end $$;
create or replace function public.guard_last_admin_v48() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.role='admin' and old.is_active and (tg_op='DELETE' or new.role<>'admin' or not new.is_active) then
  perform pg_advisory_xact_lock(hashtextextended('songapp-active-admins',48));
  if not exists(select 1 from public.profiles where id<>old.id and role='admin' and is_active) then raise exception 'Trebuie să rămână cel puțin un administrator activ.'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
drop trigger if exists guard_last_admin_v48 on public.profiles;
create trigger guard_last_admin_v48 before update or delete on public.profiles for each row execute function public.guard_last_admin_v48();
create or replace function public.new_account_pending_v48() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,email,full_name,role,is_active)
 values(new.id,new.email,left(to_jsonb(new)->'raw_user_meta_data'->>'full_name',120),'viewer',false) on conflict(id) do nothing;
 return new;
end $$;
drop trigger if exists songapp_pending_profile_v48 on auth.users;
create trigger songapp_pending_profile_v48 after insert on auth.users for each row execute function public.new_account_pending_v48();
insert into public.profiles(id,email,role,is_active) select id,email,'viewer',false from auth.users on conflict(id) do nothing;
create or replace function public.admin_set_profile_v48(p_id uuid,p_role text,p_active boolean) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Doar administratorii pot gestiona conturile.' using errcode='42501'; end if;
 if p_role not in ('admin','editor','worship_leader','viewer') or p_active is null then raise exception 'Rol invalid.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('songapp-active-admins',48));
 update public.profiles set role=p_role::public.app_role,is_active=p_active where id=p_id;
 if not found then raise exception 'Contul nu mai există.'; end if;
 return true;
end $$;
revoke all on function public.admin_set_profile_v48(uuid,text,boolean) from public,anon;
grant execute on function public.admin_set_profile_v48(uuid,text,boolean) to authenticated;
create or replace function public.record_activity_v48(p_event text,p_path text default null,p_details jsonb default '{}') returns boolean language plpgsql security definer set search_path=public as $$
begin
 if public.current_user_role() is null then raise exception 'Acces inactiv.' using errcode='42501'; end if;
 if p_event not in ('auth.login','auth.logout','account.password','request.view','request.action','program.print','song.present','import.preview','search') then raise exception 'Eveniment invalid.'; end if;
 insert into public.activity_log_v48(actor_id,actor_email,event_type,path,details)
 values(auth.uid(),(select email from public.profiles where id=auth.uid()),p_event,left(split_part(p_path,'?',1),500),
 jsonb_strip_nulls(jsonb_build_object('query',left(p_details->>'query',300),'source_host',left(p_details->>'source_host',200),'count',p_details->>'count','format',left(p_details->>'format',40))));
 return true;
end $$;
revoke all on function public.record_activity_v48(text,text,jsonb) from public,anon;
grant execute on function public.record_activity_v48(text,text,jsonb) to authenticated;
create or replace function public.record_auth_failure_v48(p_event text,p_email text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Acces interzis.' using errcode='42501'; end if;
 if p_event not in ('auth.failure','auth.denied','admin.create_failure') then raise exception 'Eveniment invalid.'; end if;
 insert into public.activity_log_v48(event_type,actor_email) values(p_event,left(p_email,320));return true;
end $$;
revoke all on function public.record_auth_failure_v48(text,text) from public,anon,authenticated;
grant execute on function public.record_auth_failure_v48(text,text) to service_role;
create or replace function public.record_public_view_v48(p_slug text,p_event text default 'public.view') returns boolean language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if p_event not in ('public.view','public.print') then raise exception 'Eveniment invalid.'; end if;
 select meeting_id into v_id from public.meeting_share_links where public_slug=p_slug and is_active and (expires_at is null or expires_at>now());
 if v_id is null then return false; end if;
 insert into public.activity_log_v48(event_type,resource_type,resource_id,path) values(p_event,'meetings',v_id::text,'/program/[shared]');return true;
end $$;
revoke all on function public.record_public_view_v48(text,text) from public;
grant execute on function public.record_public_view_v48(text,text) to anon,authenticated;
create table if not exists public.runtime_health_v48(id integer primary key check(id=1),status text not null);
insert into public.runtime_health_v48 values(1,'ready') on conflict(id) do nothing;
alter table public.runtime_health_v48 enable row level security;
revoke all on public.runtime_health_v48 from public,anon,authenticated;
create or replace function public.songapp_health_v48() returns boolean language sql stable security definer set search_path=public as $$ select status='ready' from public.runtime_health_v48 where id=1 $$;
revoke all on function public.songapp_health_v48() from public;
grant execute on function public.songapp_health_v48() to anon,authenticated;
alter table public.meeting_share_links add column if not exists allow_contributions boolean not null default false;

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
      'allow_contributions', l.allow_contributions,
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
      and l.is_active = true and l.allow_contributions
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
    and l.is_active = true and l.allow_contributions
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
notify pgrst,'reload schema';
commit;
