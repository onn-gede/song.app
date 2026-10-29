begin;
create or replace function public.collection_song_counts_v56() returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from (
 select sc.id as collection_id,count(distinct s.id) filter(where s.is_active) as song_count from public.song_collections sc left join public.song_sources ss on ss.collection_id=sc.id left join public.songs s on s.id=ss.song_id where public.current_user_role() is not null group by sc.id
 ) c;
$$;
revoke all on function public.collection_song_counts_v56() from public,anon;
grant execute on function public.collection_song_counts_v56() to authenticated;
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
    and (p_sort not in ('most_sung','last_sung') or coalesce(u.times_sung,0)>0)
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

create or replace function public.activity_resource_label_v56(kind text,rid text) returns text language plpgsql stable security invoker set search_path=public as $$
declare uid uuid; label text;
begin
 if rid is null or rid !~ '^[0-9a-fA-F-]{36}$' then return null;end if;
 begin uid:=rid::uuid;exception when invalid_text_representation then return null;end;
 case kind
 when 'songs' then select title into label from public.songs where id=uid;
 when 'meetings' then select title into label from public.meetings where id=uid;
 when 'song_collections' then select name into label from public.song_collections where id=uid;
 when 'categories' then select name into label from public.categories where id=uid;
 when 'profiles' then select coalesce(full_name,email) into label from public.profiles where id=uid;
 when 'meeting_items' then select coalesce(s.title,i.custom_title,'Moment')||' · '||m.title into label from public.meeting_items i join public.meetings m on m.id=i.meeting_id left join public.songs s on s.id=i.song_id where i.id=uid;
 when 'song_sections' then select s.title into label from public.song_sections x join public.songs s on s.id=x.song_id where x.id=uid;
 when 'song_sources' then select s.title||' · '||c.name into label from public.song_sources x join public.songs s on s.id=x.song_id join public.song_collections c on c.id=x.collection_id where x.id=uid;
 when 'song_files' then select file_name into label from public.song_files where id=uid;
 when 'meeting_share_links' then select m.title into label from public.meeting_share_links x join public.meetings m on m.id=x.meeting_id where x.id=uid;
 when 'public_meeting_contributions' then select coalesce(s.title,x.custom_title,'Propunere')||' · '||m.title into label from public.public_meeting_contributions x join public.meetings m on m.id=x.meeting_id left join public.songs s on s.id=x.song_id where x.id=uid;
 else label:=null;
 end case;
 return label;
end $$;
revoke all on function public.activity_resource_label_v56(text,text) from public,anon;
grant execute on function public.activity_resource_label_v56(text,text) to authenticated;
create or replace function public.audit_write_v48() returns trigger language plpgsql security definer set search_path=public as $$
declare v_old jsonb;v_new jsonb;v_row jsonb;v_fields jsonb;v_before jsonb;v_after jsonb;v_label text;
begin
 v_old:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 v_new:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 v_row:=case when tg_op='DELETE' then v_old else v_new end;
 select coalesce(jsonb_agg(key order by key),'[]') into v_fields from (select key from jsonb_each(v_old||v_new) where (v_old->key) is distinct from (v_new->key)) x;
 -- Never copy credentials, full lyrics, notes, tokens or share slugs into audit data.
 select coalesce(jsonb_object_agg(key,value),'{}') into v_before from jsonb_each(v_old) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions','color','selected_source_id','is_congregational']);
 select coalesce(jsonb_object_agg(key,value),'{}') into v_after from jsonb_each(v_new) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions','color','selected_source_id','is_congregational']);
 v_label:=coalesce(v_row->>'title',v_row->>'name',v_row->>'custom_title',public.activity_resource_label_v56(tg_table_name,v_row->>'id'),
  (select title from public.songs where id=nullif(v_row->>'song_id','')::uuid),
  (select title from public.meetings where id=nullif(v_row->>'meeting_id','')::uuid));
 insert into public.activity_log_v48(actor_id,actor_email,event_type,resource_type,resource_id,details)
 values(auth.uid(),(select email from public.profiles where id=auth.uid()),lower(tg_op),tg_table_name,coalesce(v_row->>'id',v_row->>'song_id',v_row->>'source_key'),jsonb_build_object('fields',v_fields,'before',v_before,'after',v_after,'resource_label',v_label));
 return null;
end $$;


create or replace function public.activity_feed_v56(p_page integer default 1,p_group text default 'changes',p_actor text default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'Acces interzis.' using errcode='42501';end if;
 with filtered as materialized (
 select l.* from public.activity_log_v48 l where (nullif(trim(p_actor),'') is null or actor_email=trim(p_actor)) and
 (p_group='all' or p_group='changes' and event_type in ('insert','update','delete') or p_group='access' and (event_type like 'request.%' or event_type like 'public.%') or p_group='auth' and event_type like 'auth.%')
 ), paged as (select * from filtered order by id desc limit 50 offset (greatest(least(coalesce(p_page,1),100000),1)-1)*50)
 select jsonb_build_object('total',(select count(*) from filtered),'entries',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('resource_label',coalesce(p.details->>'resource_label',p.details->'after'->>'title',p.details->'after'->>'name',p.details->'before'->>'title',p.details->'before'->>'name',public.activity_resource_label_v56(p.resource_type,p.resource_id))) order by p.id desc) from paged p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.activity_feed_v56(integer,text,text) from public,anon;
grant execute on function public.activity_feed_v56(integer,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
