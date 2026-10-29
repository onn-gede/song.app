-- v44: one library for search + collection/category/key filters.
-- Read-only RPC, with the same RLS and active-profile guard as v42.
begin;
create or replace function public.list_song_library_v44(
  p_collection uuid default null, p_category uuid default null, p_number text default null,
  p_status text default null, p_key text default null, p_sort text default 'title_asc',
  p_page integer default 1, p_page_size integer default 50, p_query text default null
) returns jsonb language sql stable security invoker set search_path = public as $$
with filtered as materialized (
  select s.id,s.title,s.default_key,s.bpm,s.structure,s.created_at,
    (select min(nullif(regexp_replace(src.song_number,'[^0-9]','','g'),'')::numeric)
       from public.song_sources src where src.song_id=s.id
       and (p_collection is null or src.collection_id=p_collection)) as source_number
  from public.songs s
  where s.is_active
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
revoke execute on function public.list_song_library_v44(uuid,uuid,text,text,text,text,integer,integer,text) from public,anon;
grant execute on function public.list_song_library_v44(uuid,uuid,text,text,text,text,integer,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
