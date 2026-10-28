begin;
-- A receipt is scoped to the signed-in author. Repeating a request returns its original program.
create table if not exists public.meeting_create_requests_v49(
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 meeting_id uuid not null references public.meetings(id) on delete cascade,
 primary key(user_id,request_id)
);
alter table public.meeting_create_requests_v49 enable row level security;
revoke all on public.meeting_create_requests_v49 from public,anon,authenticated;
create or replace function public.create_meeting_once_v49(p_request_id uuid,p_title text,p_meeting_type text,p_meeting_date timestamptz,p_notes text default null,p_song_id uuid default null,p_is_backup boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
 if p_request_id is null or length(trim(coalesce(p_title,''))) not between 1 and 200 or p_meeting_date is null or not isfinite(p_meeting_date) then raise exception 'Titlul și data sunt obligatorii.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,49));
 select meeting_id into v_id from public.meeting_create_requests_v49 where user_id=auth.uid() and request_id=p_request_id;
 if v_id is not null then return v_id; end if;
 v_id:=public.create_meeting(trim(p_title),p_meeting_type,p_meeting_date,p_notes);
 if p_song_id is not null then perform public.add_song_to_meeting(v_id,p_song_id,coalesce(p_is_backup,false),null,null); end if;
 insert into public.meeting_create_requests_v49 values(auth.uid(),p_request_id,v_id);
 return v_id;
end $$;
revoke all on function public.create_meeting_once_v49(uuid,text,text,timestamptz,text,uuid,boolean) from public,anon;
grant execute on function public.create_meeting_once_v49(uuid,text,text,timestamptz,text,uuid,boolean) to authenticated;

-- Fixed unaccent dictionary used by the search expression indexes.
create or replace function public.search_fold_v49(value text) returns text language sql immutable parallel safe set search_path=public as $$ select lower(public.unaccent(coalesce(value,''))) $$;
create index if not exists songs_title_search_v49 on public.songs using gin(public.search_fold_v49(title) gin_trgm_ops) where is_active;
create index if not exists source_title_search_v49 on public.song_sources using gin(public.search_fold_v49(source_title) gin_trgm_ops);
create index if not exists source_number_search_v49 on public.song_sources (public.search_fold_v49(song_number) text_pattern_ops);

create or replace function public.search_program_songs_v49(p_query text,p_limit integer default 8)
returns table(song_id uuid,title text,default_key text,bpm integer,rank real,matched_source text)
language plpgsql security definer set search_path=public as $$
declare term text;pattern text;number_term text;
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501'; end if;
 term:=public.search_fold_v49(left(trim(coalesce(p_query,'')),160));
 if length(term)<2 and term!~'^[0-9]$' then return; end if;
 pattern:='%'||replace(replace(replace(term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 number_term:=regexp_replace(term,'^nr\.?\s*','');
 perform public.record_activity_v48('search','/api/songs/search',jsonb_build_object('query',term));
 return query
 with title_matches as materialized (
  select s.id,case when public.search_fold_v49(s.title)=term then 0 when public.search_fold_v49(s.title) like substr(pattern,2) then 1 else 2 end priority
  from public.songs s where s.is_active and public.search_fold_v49(s.title) like pattern
  order by priority,s.title,s.id limit 80
 ), source_matches as materialized (
  select s.id,case when public.search_fold_v49(ss.song_number)=number_term then 0 else 3 end priority
  from public.song_sources ss join public.songs s on s.id=ss.song_id and s.is_active
  where public.search_fold_v49(ss.song_number) like replace(replace(replace(number_term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%'
    or public.search_fold_v49(ss.source_title) like pattern
  order by priority,s.title,s.id limit 80
 ), lyric_matches as materialized (
  select s.id,4 priority from public.songs s where s.is_active and length(term)>=2 and (s.search_vector @@ plainto_tsquery('simple',term) or s.search_text like pattern)
  order by s.title,s.id limit 80
 ), chosen as (
  select s.id,s.title,s.default_key,s.bpm,min(c.priority) priority from (select * from title_matches union all select * from source_matches union all select * from lyric_matches)c join public.songs s on s.id=c.id
  group by s.id order by min(c.priority),s.title,s.id limit least(greatest(coalesce(p_limit,8),1),30)
 )
 select c.id,c.title,c.default_key,c.bpm,(5-c.priority)::real,
  (select string_agg(distinct coalesce(sc.short_code,sc.name)||case when ss.song_number is not null then ' nr. '||ss.song_number else '' end,', ')
   from public.song_sources ss join public.song_collections sc on sc.id=ss.collection_id where ss.song_id=c.id)
 from chosen c order by c.priority,c.title,c.id;
end $$;
revoke all on function public.search_program_songs_v49(text,integer) from public,anon;
grant execute on function public.search_program_songs_v49(text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
