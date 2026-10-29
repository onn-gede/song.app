begin;
alter table public.song_collections add column if not exists opacity integer not null default 100 check(opacity in (25,50,75,100));
alter table public.meeting_items add column if not exists moment_color text not null default '#d97706' check(moment_color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.meeting_items add column if not exists moment_kind text check(moment_kind in ('song','prayer','message','encouragement','text','break','other'));
alter table public.profiles add column if not exists moderation_state text not null default 'visible' check(moderation_state in ('visible','rejected','hidden'));
create or replace function public.guard_profile_moderation_v57() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.moderation_state is distinct from old.moderation_state and not(coalesce(auth.role()='service_role',false) or coalesce(public.current_user_role()='admin'::public.app_role,false)) then raise exception 'Doar administratorii pot modera conturi.' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_profile_moderation_v57() from public,anon,authenticated;
drop trigger if exists profile_moderation_v57 on public.profiles;
create trigger profile_moderation_v57 before update of moderation_state on public.profiles for each row execute function public.guard_profile_moderation_v57();
create or replace function public.admin_moderate_user_v57(p_id uuid,p_remove boolean default false) returns void language plpgsql security definer set search_path=public as $$
declare target public.profiles;
begin
 if public.current_user_role() is distinct from 'admin'::public.app_role or p_id=auth.uid() then raise exception 'Acces interzis.' using errcode='42501';end if;
 select * into target from public.profiles where id=p_id for update;
 if not found or target.is_active then raise exception 'Se pot respinge/elimina numai conturi inactive.';end if;
 update public.profiles set is_active=false,moderation_state=case when p_remove then 'hidden' else 'rejected' end where id=p_id;
end $$;
revoke all on function public.admin_moderate_user_v57(uuid,boolean) from public,anon;
grant execute on function public.admin_moderate_user_v57(uuid,boolean) to authenticated;
create or replace function public.add_moment_v57(p_meeting_id uuid,p_item_type text,p_custom_title text,p_custom_text text,p_color text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_item_type not in ('song','prayer','message','encouragement','text','break','other') or p_color is null or p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Moment invalid.';end if;
 v_id:=public.add_text_to_meeting(p_meeting_id,case when p_item_type='other' then 'text' else p_item_type end,coalesce(nullif(trim(p_custom_title),''),case when p_item_type='other' then 'Diverse' when p_item_type='song' then 'Cântare' else null end),p_custom_text);
 update public.meeting_items set moment_color=p_color,moment_kind=p_item_type where meeting_items.id=v_id;
 return v_id;
end $$;
revoke all on function public.add_moment_v57(uuid,text,text,text,text) from public,anon;
grant execute on function public.add_moment_v57(uuid,text,text,text,text) to authenticated;
create or replace function public.song_number_fold_v57(value text) returns text language sql immutable parallel safe set search_path=public as $$
 select case when v ~ '^[0-9]+[a-z]?$' then coalesce(nullif(regexp_replace(v,'^0+',''),''),'0') else v end from (select regexp_replace(lower(trim(coalesce(value,''))),'^nr\.?\s*','') v) x;
$$;
revoke all on function public.song_number_fold_v57(text) from public,anon;
grant execute on function public.song_number_fold_v57(text) to authenticated;
create index if not exists source_number_fold_v57 on public.song_sources(public.song_number_fold_v57(song_number));
create or replace function public.song_sources_v52(p_song_id uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('source_id',ss.id,'collection_id',c.id,'name',c.name,'short_code',c.short_code,'color',c.color,'opacity',c.opacity,'number',ss.song_number,'is_active',c.is_active) order by c.is_active desc,c.name,ss.song_number,ss.id),'[]'::jsonb)
 from public.song_sources ss join public.song_collections c on c.id=ss.collection_id where ss.song_id=p_song_id;
$$;
revoke all on function public.song_sources_v52(uuid) from public,anon;
grant execute on function public.song_sources_v52(uuid) to authenticated;
drop trigger if exists touch_collection_programs_v52 on public.song_collections;
create trigger touch_collection_programs_v52 after update of color,name,short_code,opacity on public.song_collections for each row when(old.color is distinct from new.color or old.name is distinct from new.name or old.short_code is distinct from new.short_code or old.opacity is distinct from new.opacity) execute function public.touch_collection_programs_v52();
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
        (public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(p_query) or ss.song_number ilike '%'||p_query||'%' or lower(public.unaccent(coalesce(ss.source_title,''))) ilike '%'||lower(public.unaccent(p_query))||'%')))
    and (p_key is null or s.default_key=p_key)
    and (p_collection is null or exists(select 1 from public.song_sources src where src.song_id=s.id and src.collection_id=p_collection))
    and (p_category is null or exists(select 1 from public.song_categories c where c.song_id=s.id and c.category_id=p_category))
    and (nullif(trim(p_number),'') is null or exists(select 1 from public.song_sources src where src.song_id=s.id and (public.song_number_fold_v57(src.song_number)=public.song_number_fold_v57(p_number) or src.song_number ilike '%'||p_number||'%' or src.source_title ilike '%'||p_number||'%')))
    and (p_status is null or exists(select 1 from public.song_files f where f.song_id=s.id and f.import_status::text=p_status))
), paged as (
  select * from filtered
  order by
    case when exists(select 1 from public.song_sources ex where ex.song_id=filtered.id and public.song_number_fold_v57(ex.song_number)=public.song_number_fold_v57(p_query) and trim(coalesce(p_query,''))<>'') then 0 else 1 end,
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
    'song_sources',(select coalesce(jsonb_agg(jsonb_build_object('source_id',ss.id,'song_number',ss.song_number,'source_title',ss.source_title,'song_collections',jsonb_build_object('id',sc.id,'name',sc.name,'short_code',sc.short_code)) order by sc.name,ss.song_number,ss.id),'[]'::jsonb) from public.song_sources ss left join public.song_collections sc on sc.id=ss.collection_id where ss.song_id=p.id),
    'song_categories',(select coalesce(jsonb_agg(jsonb_build_object('categories',jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug)) order by c.name),'[]'::jsonb) from public.song_categories x join public.categories c on c.id=x.category_id where x.song_id=p.id),
    'song_files',(select coalesce(jsonb_agg(jsonb_build_object('import_status',sf.import_status) order by sf.created_at,sf.id),'[]'::jsonb) from public.song_files sf where sf.song_id=p.id)
  )) from paged p),'[]'::jsonb)
);
$$;
revoke all on function public.list_song_library_v46(uuid,uuid,text,text,text,text,integer,integer,text) from public,anon;
grant execute on function public.list_song_library_v46(uuid,uuid,text,text,text,text,integer,integer,text) to authenticated;

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
  select distinct s.id,s.title as source_song_title,case when public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(number_term) then 0 else 3 end priority
  from public.song_sources ss join public.songs s on s.id=ss.song_id and s.is_active
  where public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(number_term) or public.search_fold_v49(ss.song_number) like replace(replace(replace(number_term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%'
    or public.search_fold_v49(ss.source_title) like pattern
  order by priority,source_song_title,s.id
 ), lyric_matches as materialized (
  select s.id,4 priority from public.songs s where s.is_active and length(term)>=2 and (s.search_vector @@ plainto_tsquery('simple',term) or s.search_text like pattern)
  order by s.title,s.id limit 80
 ), chosen as (
  select s.id,s.title,s.default_key,s.bpm,min(c.priority) priority from (select * from title_matches union all select id,priority from source_matches union all select * from lyric_matches)c join public.songs s on s.id=c.id
  group by s.id order by min(c.priority),s.title,s.id limit least(greatest(coalesce(p_limit,8),1),30)
 )
 select c.id,c.title,c.default_key,c.bpm,(5-c.priority)::real,
  (select string_agg(distinct coalesce(sc.short_code,sc.name)||case when ss.song_number is not null then ' nr. '||ss.song_number else '' end,', ')
   from public.song_sources ss join public.song_collections sc on sc.id=ss.collection_id where ss.song_id=c.id)
 from chosen c order by c.priority,c.title,c.id;
end $$;
revoke all on function public.search_program_songs_v49(text,integer) from public,anon;
grant execute on function public.search_program_songs_v49(text,integer) to authenticated;
alter table public.meeting_items add column if not exists add_request_id_v57 uuid;
create unique index if not exists meeting_item_add_request_v57 on public.meeting_items(add_request_id_v57) where add_request_id_v57 is not null;
create or replace function public.add_program_song_v57(p_meeting_id uuid,p_song_id uuid,p_request_id uuid,p_source_id uuid default null,p_is_backup boolean default false,p_selected_key text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare iid uuid; saved jsonb; existing public.meeting_items;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_request_id is null then raise exception 'Cerere invalidă.';end if;
 perform 1 from public.meetings where id=p_meeting_id for update;
 if not found then raise exception 'Program inexistent.';end if;
 select * into existing from public.meeting_items where add_request_id_v57=p_request_id;
 if found then
  if existing.meeting_id<>p_meeting_id or existing.song_id<>p_song_id or existing.is_backup is distinct from p_is_backup or (p_source_id is not null and existing.selected_source_id is distinct from p_source_id) then raise exception 'Cerere incompatibilă.';end if;
  iid:=existing.id;
 else
  if not exists(select 1 from public.songs where id=p_song_id and is_active) then raise exception 'Cântarea nu este disponibilă.';end if;
  iid:=public.add_program_song_v52(p_meeting_id,p_song_id,p_source_id,p_is_backup,p_selected_key,null);
  update public.meeting_items set add_request_id_v57=p_request_id where id=iid;
 end if;
 saved:=public.get_meeting_snapshot_v46(p_meeting_id);
 if not exists(select 1 from jsonb_array_elements(saved->'items') x where x->>'id'=iid::text and x->>'song_id'=p_song_id::text) then raise exception 'Salvarea nu a putut fi confirmată.';end if;
 return jsonb_build_object('itemId',iid,'snapshot',saved);
end $$;
revoke all on function public.add_program_song_v57(uuid,uuid,uuid,uuid,boolean,text) from public,anon;
grant execute on function public.add_program_song_v57(uuid,uuid,uuid,uuid,boolean,text) to authenticated;
create or replace function public.create_program_with_song_v57(p_request_id uuid,p_title text,p_meeting_type text,p_meeting_date timestamptz,p_song_id uuid,p_is_backup boolean default false,p_source_id uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_source_id is not null and not exists(select 1 from public.song_sources where id=p_source_id and song_id=p_song_id) then raise exception 'Sursa invalidă.';end if;
 mid:=public.create_meeting_once_v49(p_request_id,p_title,p_meeting_type,p_meeting_date,null,p_song_id,p_is_backup);
 if p_source_id is not null then update public.meeting_items set selected_source_id=p_source_id where meeting_id=mid and song_id=p_song_id;end if;
 return mid;
end $$;
revoke all on function public.create_program_with_song_v57(uuid,text,text,timestamptz,uuid,boolean,uuid) from public,anon;
grant execute on function public.create_program_with_song_v57(uuid,text,text,timestamptz,uuid,boolean,uuid) to authenticated;
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
          'item_type', mi.item_type,'moment_color',mi.moment_color,'moment_kind',mi.moment_kind,
          'is_backup', mi.is_backup,
          'custom_title', mi.custom_title,
          'custom_text', mi.custom_text,
          'selected_key', mi.selected_key,
          'is_congregational',mi.is_congregational,
          'selected_source_id',mi.selected_source_id,'sources',public.song_sources_v52(mi.song_id),
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


notify pgrst,'reload schema';
commit;
