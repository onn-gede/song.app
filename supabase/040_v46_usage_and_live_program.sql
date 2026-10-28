begin;
-- Revision guards live client state against a delayed/stale route render.
alter table public.meetings add column if not exists program_revision bigint not null default 0;
create or replace function public.bump_program_revision_v46() returns trigger language plpgsql set search_path=public as $$
begin new.program_revision := old.program_revision + 1; return new; end $$;
drop trigger if exists meetings_revision_v46 on public.meetings;
create trigger meetings_revision_v46 before update on public.meetings for each row execute function public.bump_program_revision_v46();
create or replace function public.touch_program_items_v46() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op <> 'INSERT' then update public.meetings set updated_at=now() where id=old.meeting_id; end if;
  if tg_op='INSERT' or (tg_op='UPDATE' and new.meeting_id<>old.meeting_id) then
    update public.meetings set updated_at=now() where id=new.meeting_id;
  end if;
  return null;
end $$;
drop trigger if exists meeting_items_revision_v46 on public.meeting_items;
create trigger meeting_items_revision_v46 after insert or update or delete on public.meeting_items for each row execute function public.touch_program_items_v46();
create or replace function public.get_meeting_snapshot_v46(p_meeting_id uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object('revision',m.program_revision,'principal',m.principal_responsible,'secondary',m.secondary_responsibles,
    'items',coalesce((select jsonb_agg(to_jsonb(mi)||jsonb_build_object('songs',
      case when s.id is null then null else jsonb_build_object('id',s.id,'title',s.title,'lyrics_text',s.lyrics_text,'default_key',s.default_key,'bpm',s.bpm,'structure',s.structure) end) order by mi.position,mi.id)
    from public.meeting_items mi left join public.songs s on s.id=mi.song_id where mi.meeting_id=m.id),'[]'::jsonb))
  from public.meetings m where m.id=p_meeting_id;
$$;
revoke all on function public.get_meeting_snapshot_v46(uuid) from public,anon;
grant execute on function public.get_meeting_snapshot_v46(uuid) to authenticated;

-- One occurrence per real meeting. Backups, templates and future dates are excluded.
create or replace view public.song_performance_occurrences_v46 with (security_invoker=true) as
select distinct mi.song_id,m.id as meeting_id,m.title as meeting_title,m.meeting_date,m.meeting_type
from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
where mi.song_id is not null and not mi.is_backup and not m.is_template and m.meeting_date<=now();
revoke all on public.song_performance_occurrences_v46 from public,anon;
grant select on public.song_performance_occurrences_v46 to authenticated;
create index if not exists meeting_items_performance_v46 on public.meeting_items(song_id,meeting_id) where song_id is not null and not is_backup;

create or replace function public.get_song_history_v46(p_song_id uuid,p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security invoker set search_path=public as $$
with uses as materialized (select * from public.song_performance_occurrences_v46 where song_id=p_song_id),
rows as (select * from uses order by meeting_date desc,meeting_id limit least(greatest(coalesce(p_page_size,30),1),100) offset (greatest(coalesce(p_page,1),1)::bigint-1)*least(greatest(coalesce(p_page_size,30),1),100))
select jsonb_build_object('total',(select count(*) from uses),'last_used_at',(select max(meeting_date) from uses),
  'entries',coalesce((select jsonb_agg(to_jsonb(rows) order by meeting_date desc,meeting_id) from rows),'[]'::jsonb));
$$;
revoke all on function public.get_song_history_v46(uuid,integer,integer) from public,anon;
grant execute on function public.get_song_history_v46(uuid,integer,integer) to authenticated;

create or replace function public.list_song_library_v46(
  p_collection uuid default null, p_category uuid default null, p_number text default null,
  p_status text default null, p_key text default null, p_sort text default 'title_asc',
  p_page integer default 1, p_page_size integer default 50, p_query text default null
) returns jsonb language sql stable security invoker set search_path = public as $$
with usage as materialized (
  select song_id,count(*) as times_sung,max(meeting_date) as last_used_at
  from public.song_performance_occurrences_v46 group by song_id
), filtered as materialized (
  select s.id,s.title,s.default_key,s.bpm,s.structure,s.created_at,coalesce(u.times_sung,0) as times_sung,u.last_used_at,
    (select min(nullif(regexp_replace(src.song_number,'[^0-9]','','g'),'')::numeric)
       from public.song_sources src where src.song_id=s.id
       and (p_collection is null or src.collection_id=p_collection)) as source_number
  from public.songs s left join usage u on u.song_id=s.id
  where s.is_active
    and (p_sort is distinct from 'most_sung' or coalesce(u.times_sung,0)>0)
    and (nullif(trim(p_query),'') is null
      or s.search_vector @@ plainto_tsquery('simple',public.unaccent(p_query))
      or s.search_text ilike '%'||lower(public.unaccent(p_query))||'%'
      or exists(select 1 from public.song_sources ss where ss.song_id=s.id and
        (ss.song_number ilike '%'||p_query||'%' or lower(public.unaccent(coalesce(ss.source_title,''))) ilike '%'||lower(public.unaccent(p_query))||'%')))
    and (p_key is null or s.default_key=p_key)
    and (p_collection is null or exists(select 1 from public.song_sources src where src.song_id=s.id and src.collection_id=p_collection))
    and (p_category is null or exists(select 1 from public.song_categories c where c.song_id=s.id and c.category_id=p_category))
    and (nullif(trim(p_number),'') is null or exists(select 1 from public.song_sources src where src.song_id=s.id and (src.song_number ilike '%'||p_number||'%' or src.source_title ilike '%'||p_number||'%')))
    and (p_status is null or exists(select 1 from public.song_files f where f.song_id=s.id and f.import_status::text=p_status))
), paged as (
  select * from filtered
  order by
    case when p_sort='most_sung' then times_sung end desc nulls last,
    case when p_sort in ('most_sung','last_sung') then last_used_at end desc nulls last,
    case when p_sort='created_desc' then created_at end desc,
    case when p_sort='source_number_asc' then source_number end asc nulls last,
    case when p_sort='source_number_desc' then source_number end desc nulls last,
    case when p_sort='title_desc' then title end desc,
    case when p_sort<>'title_desc' then title end asc,
    id
  limit least(greatest(coalesce(p_page_size,50),1),100)
  offset (greatest(coalesce(p_page,1),1)::bigint-1)*least(greatest(coalesce(p_page_size,50),1),100)
)
select jsonb_build_object(
  'total',(select count(*) from filtered),
  'keys',(select coalesce(jsonb_agg(k.default_key order by k.default_key),'[]'::jsonb) from (select distinct default_key from public.songs where is_active and default_key is not null) k),
  'songs',coalesce((select jsonb_agg(to_jsonb(p)-'source_number' || jsonb_build_object(
    'song_sources',(select coalesce(jsonb_agg(jsonb_build_object('song_number',ss.song_number,'source_title',ss.source_title,'song_collections',jsonb_build_object('id',sc.id,'name',sc.name,'short_code',sc.short_code)) order by sc.name,ss.song_number,ss.id),'[]'::jsonb) from public.song_sources ss left join public.song_collections sc on sc.id=ss.collection_id where ss.song_id=p.id),
    'song_categories',(select coalesce(jsonb_agg(jsonb_build_object('categories',jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug)) order by c.name),'[]'::jsonb) from public.song_categories x join public.categories c on c.id=x.category_id where x.song_id=p.id),
    'song_files',(select coalesce(jsonb_agg(jsonb_build_object('import_status',sf.import_status) order by sf.created_at,sf.id),'[]'::jsonb) from public.song_files sf where sf.song_id=p.id)
  )) from paged p),'[]'::jsonb)
);
$$;
revoke all on function public.list_song_library_v46(uuid,uuid,text,text,text,text,integer,integer,text) from public,anon;
grant execute on function public.list_song_library_v46(uuid,uuid,text,text,text,text,integer,integer,text) to authenticated;

create or replace function public.get_song_recent_usage(days_back integer default 30)
returns table(song_id uuid,title text,last_used_at timestamptz,times_used bigint,last_meeting_title text)
language sql stable security invoker set search_path=public as $$
with ranked as (
 select o.*,s.title,row_number() over(partition by o.song_id order by o.meeting_date desc,o.meeting_id) as rn
 from public.song_performance_occurrences_v46 o join public.songs s on s.id=o.song_id
 where o.meeting_date>=now()-make_interval(days=>greatest(coalesce(days_back,30),0))
 
) select song_id,title,max(meeting_date),count(*),max(meeting_title) filter(where rn=1) from ranked group by song_id,title order by max(meeting_date) desc;
$$;

create or replace function public.get_song_recent_usage_excluding_meeting(days_back integer default 30, excluded_meeting_id uuid default null)
returns table(song_id uuid,title text,last_used_at timestamptz,times_used bigint,last_meeting_title text)
language sql stable security invoker set search_path=public as $$
with ranked as (
 select o.*,s.title,row_number() over(partition by o.song_id order by o.meeting_date desc,o.meeting_id) as rn
 from public.song_performance_occurrences_v46 o join public.songs s on s.id=o.song_id
 where o.meeting_date>=now()-make_interval(days=>greatest(coalesce(days_back,30),0))
 and (excluded_meeting_id is null or o.meeting_id<>excluded_meeting_id)
) select song_id,title,max(meeting_date),count(*),max(meeting_title) filter(where rn=1) from ranked group by song_id,title order by max(meeting_date) desc;
$$;
notify pgrst,'reload schema';
commit;
