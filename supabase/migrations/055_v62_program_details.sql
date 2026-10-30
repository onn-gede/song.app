begin;
alter table public.songs add column if not exists verse_count_override integer check(verse_count_override between 0 and 100);
alter table public.meeting_items add column if not exists performance_structure text;
create or replace function public.song_details_internal_v62(p_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('verse_count',coalesce(s.verse_count_override,(select nullif(count(*) filter(where section_type='verse'),0)::int from public.song_sections where song_id=s.id)),
 'structure',s.structure,
 'first_verse',coalesce((select left(content,2500) from public.song_sections where song_id=s.id and section_type='verse' order by position,id limit 1),nullif(left(split_part(coalesce(s.lyrics_text,''),E'\n\n',1),2500),'')),
 'chorus',(select left(content,2500) from public.song_sections where song_id=s.id and section_type='chorus' order by position,id limit 1)) from public.songs s where s.id=p_id;
$$;
revoke all on function public.song_details_internal_v62(uuid) from public,anon,authenticated;
create or replace function public.song_details_v62(p_song_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 return public.song_details_internal_v62(p_song_id);
end $$;
revoke all on function public.song_details_v62(uuid) from public,anon;
grant execute on function public.song_details_v62(uuid) to authenticated;
create or replace function public.get_meeting_snapshot_v46(p_meeting_id uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('revision',m.program_revision,'principal',m.principal_responsible,'secondary',m.secondary_responsibles,
 'items',coalesce((select jsonb_agg(to_jsonb(mi)||jsonb_build_object('sources',public.song_sources_v52(mi.song_id),'songs',case when s.id is null then null else jsonb_build_object('id',s.id,'title',s.title,'lyrics_text',s.lyrics_text,'default_key',s.default_key,'bpm',s.bpm,'structure',s.structure)||public.song_details_v62(s.id) end) order by mi.position,mi.id)
 from public.meeting_items mi left join public.songs s on s.id=mi.song_id where mi.meeting_id=m.id),'[]'::jsonb)) from public.meetings m where m.id=p_meeting_id;
$$;
revoke all on function public.get_meeting_snapshot_v46(uuid) from public,anon;
grant execute on function public.get_meeting_snapshot_v46(uuid) to authenticated;
create or replace function public.get_shared_meeting(p_public_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'meeting', jsonb_build_object(
      'id',m.id,'title', m.title,
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
          'id',mi.id,'performance_structure',mi.performance_structure,'position', mi.position,
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
            'id',s.id,'verse_count',(public.song_details_internal_v62(s.id)->'verse_count'),'title', s.title,
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


create or replace function public.search_program_songs_filtered_v62(p_query text,p_limit integer default 8,p_collection uuid default null,p_category uuid default null,p_key text default null)
returns table(song_id uuid,title text,default_key text,bpm integer,rank real,matched_source text)
language plpgsql security definer set search_path=public as $$
declare term text;pattern text;number_term text;
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501'; end if;
 term:=public.search_fold_v49(left(trim(coalesce(p_query,'')),160));
 if length(term)<2 and term!~'^[0-9]$' and p_collection is null and p_category is null and p_key is null then return; end if;
 pattern:='%'||replace(replace(replace(term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 number_term:=regexp_replace(term,'^nr\.?\s*','');
 perform public.record_activity_v48('search','/api/songs/search',jsonb_build_object('query',term));
 return query
 with title_matches as materialized (
  select s.id,case when public.search_fold_v49(s.title)=term then 0 when public.search_fold_v49(s.title) like substr(pattern,2) then 1 else 2 end priority
  from public.songs s where s.is_active and (p_collection is null or exists(select 1 from public.song_sources z where z.song_id=s.id and z.collection_id=p_collection)) and (p_category is null or exists(select 1 from public.song_categories z where z.song_id=s.id and z.category_id=p_category)) and (p_key is null or s.default_key=p_key) and public.search_fold_v49(s.title) like pattern
  order by priority,s.title,s.id limit 80
 ), source_matches as materialized (
  select distinct s.id,s.title as source_song_title,case when public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(number_term) then 0 else 3 end priority
  from public.song_sources ss join public.songs s on s.id=ss.song_id and s.is_active and (p_collection is null or exists(select 1 from public.song_sources z where z.song_id=s.id and z.collection_id=p_collection)) and (p_category is null or exists(select 1 from public.song_categories z where z.song_id=s.id and z.category_id=p_category)) and (p_key is null or s.default_key=p_key)
  where public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(number_term) or public.search_fold_v49(ss.song_number) like replace(replace(replace(number_term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%'
    or public.search_fold_v49(ss.source_title) like pattern
  order by priority,source_song_title,s.id
 ), lyric_matches as materialized (
  select s.id,4 priority from public.songs s where s.is_active and (p_collection is null or exists(select 1 from public.song_sources z where z.song_id=s.id and z.collection_id=p_collection)) and (p_category is null or exists(select 1 from public.song_categories z where z.song_id=s.id and z.category_id=p_category)) and (p_key is null or s.default_key=p_key) and length(term)>=2 and (s.search_vector @@ plainto_tsquery('simple',term) or s.search_text like pattern)
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
revoke all on function public.search_program_songs_filtered_v62(text,integer,uuid,uuid,text) from public,anon;
grant execute on function public.search_program_songs_filtered_v62(text,integer,uuid,uuid,text) to authenticated;
create or replace function public.search_program_songs_v62(p_query text,p_limit integer default 30,p_exclude_meeting uuid default null,p_collection uuid default null,p_category uuid default null,p_key text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(r)||public.song_details_internal_v62(r.song_id)||jsonb_build_object('sources',case when p_collection is null then public.song_sources_v52(r.song_id) else coalesce((select jsonb_agg(src) from jsonb_array_elements(public.song_sources_v52(r.song_id)) src where src->>'collection_id'=p_collection::text),'[]'::jsonb) end,'schedule',jsonb_build_object(
 'next',(select to_jsonb(e) from public.song_program_events_v52(r.song_id,p_exclude_meeting)e where e.phase<>'finished' order by e.meeting_date,e.meeting_id limit 1),
 'last',(select to_jsonb(e) from public.song_program_events_v52(r.song_id,p_exclude_meeting)e where e.phase='finished' and not e.is_backup order by e.meeting_date desc,e.meeting_id limit 1))) order by r.rank desc,r.title,r.song_id),'[]'::jsonb) into result
 from public.search_program_songs_filtered_v62(p_query,p_limit,p_collection,p_category,p_key) r;
 return result;
end $$;
revoke all on function public.search_program_songs_v62(text,integer,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.search_program_songs_v62(text,integer,uuid,uuid,uuid,text) to authenticated;
create or replace function public.update_program_song_v62(p_meeting_id uuid,p_item_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare sid uuid; pattern text; n integer;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 perform 1 from public.meetings where id=p_meeting_id for update;
 select song_id into sid from public.meeting_items where id=p_item_id and meeting_id=p_meeting_id for update;
 if sid is null then raise exception 'Cântarea nu există în acest program.';end if;
 pattern:=nullif(regexp_replace(upper(trim(coalesce(p_data->>'performance_structure',''))),'[[:space:]]','','g'),'');
 if pattern is not null and (length(pattern)>300 or pattern !~ '^(S[0-9]*|R[0-9]*|B[0-9]*)(,(S[0-9]*|R[0-9]*|B[0-9]*))*$') then raise exception 'Structură invalidă. Exemplu: S1,R,S2,R,B,R.';end if;
 if p_data ? 'verse_count' then
  n:=nullif(p_data->>'verse_count','')::integer;
  if n is not null and (n<0 or n>100) then raise exception 'Numărul de strofe trebuie să fie între 0 și 100.';end if;
  update public.songs set verse_count_override=n where id=sid;
 end if;
 if length(coalesce(p_data->>'notes',''))>5000 or length(coalesce(p_data->>'responsible_name',''))>120 or length(coalesce(p_data->>'selected_key',''))>20 then raise exception 'Text prea lung.';end if;
 if nullif(p_data->>'selected_source_id','') is not null and not exists(select 1 from public.song_sources where id=(p_data->>'selected_source_id')::uuid and song_id=sid) then raise exception 'Colecția nu aparține cântării.';end if;
 update public.meeting_items set responsible_name=nullif(p_data->>'responsible_name',''),notes=nullif(p_data->>'notes',''),selected_key=nullif(p_data->>'selected_key',''),selected_source_id=case when p_data ? 'selected_source_id' then nullif(p_data->>'selected_source_id','')::uuid else selected_source_id end,performance_structure=pattern where id=p_item_id;
 return public.get_meeting_snapshot_v46(p_meeting_id);
end $$;
revoke all on function public.update_program_song_v62(uuid,uuid,jsonb) from public,anon;
grant execute on function public.update_program_song_v62(uuid,uuid,jsonb) to authenticated;
create or replace function public.assign_song_category_v62(p_song_id uuid,p_category_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if not exists(select 1 from public.songs where id=p_song_id and is_active) or not exists(select 1 from public.categories where id=p_category_id) then raise exception 'Cântare sau categorie inexistentă.';end if;
 insert into public.song_categories(song_id,category_id) values(p_song_id,p_category_id) on conflict do nothing;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name) from public.categories c join public.song_categories sc on sc.category_id=c.id where sc.song_id=p_song_id),'[]'::jsonb);
end $$;
revoke all on function public.assign_song_category_v62(uuid,uuid) from public,anon;
grant execute on function public.assign_song_category_v62(uuid,uuid) to authenticated;
create or replace function public.program_search_filters_v62() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 return jsonb_build_object('collections',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.song_collections where is_active),'[]'::jsonb),'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.categories),'[]'::jsonb),'keys',coalesce((select jsonb_agg(k order by k) from (select distinct default_key k from public.songs where is_active and nullif(default_key,'') is not null) x),'[]'::jsonb));
end $$;
revoke all on function public.program_search_filters_v62() from public,anon;
grant execute on function public.program_search_filters_v62() to authenticated;
create or replace function public.duplicate_meeting(p_meeting_id uuid,p_title text,p_meeting_date timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_meeting public.meetings;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  if nullif(trim(p_title),'') is null or p_meeting_date is null then raise exception 'Titlul și data sunt obligatorii.'; end if;
  select * into v_meeting from public.meetings where id=p_meeting_id for share;
  if not found then raise exception 'Programul nu există.'; end if;
  insert into public.meetings(title,meeting_type,meeting_date,notes,created_by,status,principal_responsible,secondary_responsibles) values(trim(p_title),v_meeting.meeting_type,p_meeting_date,v_meeting.notes,auth.uid(),'draft',v_meeting.principal_responsible,v_meeting.secondary_responsibles) returning id into v_id;
  insert into public.meeting_items(meeting_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name,selected_source_id,is_congregational,performance_structure,moment_kind,moment_color)
    select v_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name,selected_source_id,is_congregational,performance_structure,moment_kind,moment_color from public.meeting_items where meeting_id=p_meeting_id;
  return v_id;
end $$;


notify pgrst,'reload schema';
commit;
