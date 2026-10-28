begin;
-- Assign numbers only to newly attached songs or explicitly cleared numbers.
create or replace function public.assign_song_source_number_v47() returns trigger language plpgsql security definer set search_path=public as $$
declare v_next numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.collection_id::text,47));
  if nullif(trim(new.song_number),'') is null then
    select coalesce(max(substring(song_number from '^[0-9]+')::numeric),0)+1 into v_next
    from public.song_sources where collection_id=new.collection_id and id is distinct from new.id;
    new.song_number:=v_next::text;
  end if;
  return new;
end $$;
drop trigger if exists song_sources_number_v47 on public.song_sources;
create trigger song_sources_number_v47 before insert or update of song_number,collection_id on public.song_sources for each row execute function public.assign_song_source_number_v47();
create or replace function public.ensure_manual_collection_v47() returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('songapp-manual-collection',47));
 select id into v_id from public.song_collections where short_code='MANUAL' and is_active limit 1;
 if v_id is null then
   insert into public.song_collections(name,short_code,source_type) values('Adăugate manual','MANUAL','manual')
   on conflict(short_code) do update set is_active=true returning id into v_id;
 end if;
 return v_id;
end $$;
revoke all on function public.ensure_manual_collection_v47() from public,anon;
grant execute on function public.ensure_manual_collection_v47() to authenticated;

-- Calendar includes scheduled meetings; popularity remains past-only.
create or replace function public.get_song_history_v46(p_song_id uuid,p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security invoker set search_path=public as $$
with uses as materialized (
 select distinct mi.song_id,m.id as meeting_id,m.title as meeting_title,m.meeting_date,m.meeting_type,(m.meeting_date>now()) as is_future
 from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
 where mi.song_id=p_song_id and not mi.is_backup and not m.is_template
), rows as (select * from uses order by meeting_date desc,meeting_id limit least(greatest(coalesce(p_page_size,30),1),100) offset (greatest(coalesce(p_page,1),1)::bigint-1)*least(greatest(coalesce(p_page_size,30),1),100))
select jsonb_build_object('total',(select count(*) from uses),'performed_total',(select count(*) from uses where not is_future),
 'upcoming_total',(select count(*) from uses where is_future),'last_used_at',(select max(meeting_date) from uses where not is_future),
 'entries',coalesce((select jsonb_agg(to_jsonb(rows) order by meeting_date desc,meeting_id) from rows),'[]'::jsonb));
$$;

-- Keep the complete previous versions when a merge is explicitly confirmed.
create table if not exists public.song_merge_history_v47 (
 id uuid primary key default gen_random_uuid(),primary_song_id uuid,merged_by uuid,merged_at timestamptz not null default now(),archived_songs jsonb not null
);
alter table public.song_merge_history_v47 enable row level security;
drop policy if exists merge_history_editor_read on public.song_merge_history_v47;
create policy merge_history_editor_read on public.song_merge_history_v47 for select to authenticated using(public.can_edit_content());
grant select on public.song_merge_history_v47 to authenticated;
revoke insert,update,delete on public.song_merge_history_v47 from public,anon,authenticated;
create or replace function public.merge_duplicate_songs(p_primary_song_id uuid,p_duplicate_song_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_duplicates uuid[];v_all uuid[];v_count integer;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
 if p_primary_song_id is null then raise exception 'Alege cântarea principală.'; end if;
 select array_agg(distinct id) into v_duplicates from unnest(p_duplicate_song_ids) id where id is not null and id<>p_primary_song_id;
 if coalesce(cardinality(v_duplicates),0) not between 1 and 1000 then raise exception 'Alege între 1 și 1000 de duplicate.'; end if;
 v_all:=array_append(v_duplicates,p_primary_song_id);
 perform id from public.songs where id=any(v_all) order by id for update;
 if (select count(*) from public.songs where id=any(v_all))<>cardinality(v_all) then raise exception 'Una dintre cântări nu mai există. Reîncarcă lista.'; end if;
 if not exists(select 1 from public.songs where id=p_primary_song_id and is_active) then raise exception 'Cântarea principală nu este activă.'; end if;
 insert into public.song_merge_history_v47(primary_song_id,merged_by,archived_songs)
 select p_primary_song_id,auth.uid(),jsonb_agg(jsonb_build_object('song',to_jsonb(s),'sections',(select jsonb_agg(to_jsonb(x) order by x.position) from public.song_sections x where x.song_id=s.id),
 'sources',(select jsonb_agg(to_jsonb(x)) from public.song_sources x where x.song_id=s.id),'key_audit',(select to_jsonb(x) from public.youth_key_applied_v46 x where x.song_id=s.id)))
 from public.songs s where s.id=any(v_duplicates);
 update public.meeting_items set song_id=p_primary_song_id where song_id=any(v_duplicates);
 update public.public_meeting_contributions set song_id=p_primary_song_id where song_id=any(v_duplicates);
 update public.song_files set song_id=p_primary_song_id where song_id=any(v_duplicates);
 update public.external_song_refs set song_id=p_primary_song_id where song_id=any(v_duplicates);
 update public.song_link_imports set song_id=p_primary_song_id where song_id=any(v_duplicates);
 -- Move the original source rows: INSERT ON CONFLICT followed by DELETE lost their own conflicting rows.
 update public.song_sources set song_id=p_primary_song_id where song_id=any(v_duplicates);
 insert into public.song_categories(song_id,category_id) select distinct p_primary_song_id,category_id from public.song_categories where song_id=any(v_duplicates) on conflict do nothing;
 insert into public.song_bible_references(song_id,bible_reference_id,theme,reason,confidence,created_by)
 select distinct p_primary_song_id,bible_reference_id,theme,reason,confidence,created_by from public.song_bible_references where song_id=any(v_duplicates) on conflict do nothing;
 delete from public.songs where id=any(v_duplicates);
 get diagnostics v_count=row_count;
 return jsonb_build_object('merged',v_count,'primarySongId',p_primary_song_id);
end $$;
revoke all on function public.merge_duplicate_songs(uuid,uuid[]) from public,anon;
grant execute on function public.merge_duplicate_songs(uuid,uuid[]) to authenticated;
create or replace function public.merge_duplicate_song_groups_v47(p_groups jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_group jsonb;v_primary uuid;v_duplicates uuid[];v_used uuid[]:='{}';v_ids uuid[];v_result jsonb;v_count integer:=0;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
 if jsonb_typeof(p_groups) is distinct from 'array' or jsonb_array_length(p_groups) not between 1 and 200 then raise exception 'Alege între 1 și 200 de grupuri afișate.'; end if;
 -- Validate every plan before any write; a song cannot participate in two groups.
 for v_group in select * from jsonb_array_elements(p_groups) loop
   v_primary:=(v_group->>'primary')::uuid;
   select array_agg(distinct value::uuid) into v_duplicates from jsonb_array_elements_text(v_group->'duplicates') where value::uuid<>v_primary;
   if coalesce(cardinality(v_duplicates),0)=0 then raise exception 'Un grup nu are duplicate selectate.'; end if;
   v_ids:=array_append(v_duplicates,v_primary);
   if v_used&&v_ids then raise exception 'O cântare apare în mai multe grupuri.'; end if;
   if (select count(distinct public.normalize_song_title_for_duplicates(title)) from public.songs where id=any(v_ids))<>1 then raise exception 'Grupul conține titluri diferite. Verifică selecția.'; end if;
   v_used:=v_used||v_ids;
 end loop;
 perform id from public.songs where id=any(v_used) order by id for update;
 for v_group in select * from jsonb_array_elements(p_groups) loop
   v_primary:=(v_group->>'primary')::uuid;
   select array_agg(value::uuid) into v_duplicates from jsonb_array_elements_text(v_group->'duplicates');
   v_result:=public.merge_duplicate_songs(v_primary,v_duplicates);v_count:=v_count+(v_result->>'merged')::integer;
 end loop;
 return jsonb_build_object('merged',v_count,'groups',jsonb_array_length(p_groups));
end $$;
revoke all on function public.merge_duplicate_song_groups_v47(jsonb) from public,anon;
grant execute on function public.merge_duplicate_song_groups_v47(jsonb) to authenticated;

create or replace function public.import_reviewed_song_link(
  p_source_key text,p_url text,p_title text,p_lyrics text,p_sections jsonb,
  p_collection_ids uuid[],p_existing_song_id uuid default null,p_notes text default null,
  p_structure text default null,p_song_number text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_song uuid; v_mapped uuid; v_collection uuid; v_file uuid; v_new boolean:=false; v_collections uuid[]; v_linked integer:=0;
begin
  if not public.can_edit_content() then raise exception 'Nu ai permisiunea pentru import.' using errcode='42501'; end if;
  if p_url is null or length(p_url)>2000 or p_url !~ '^https?://[^/[:space:]@]+(/|$)' or p_source_key is null then raise exception 'Link invalid.'; end if;
  if p_source_key like 'resursecrestine:%' then
    if p_url !~ '^https://www\.resursecrestine\.ro/cantece/[0-9]+/[^/?#]+$' or p_source_key <> 'resursecrestine:'||substring(p_url from '/cantece/([0-9]+)') then raise exception 'Link invalid.'; end if;
  elsif p_source_key <> 'web:'||encode(sha256(convert_to(p_url,'UTF8')),'hex') then raise exception 'Identificator de link invalid.'; end if;
  if length(trim(coalesce(p_title,''))) not between 1 and 300 or length(trim(coalesce(p_lyrics,''))) not between 20 and 100000 then raise exception 'Verifică titlul și versurile.'; end if;
  if jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections) not between 1 and 200 then raise exception 'Secțiuni invalide.'; end if;
  select array_agg(distinct c) into v_collections from unnest(p_collection_ids) c where c is not null;
  if coalesce(cardinality(v_collections),0) not between 1 and 20 then raise exception 'Alege între 1 și 20 de colecții.'; end if;
  if (select count(*) from public.song_collections where id=any(v_collections) and is_active) <> cardinality(v_collections) then raise exception 'Una dintre colecții nu mai este activă.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_source_key,43));
  select song_id into v_mapped from public.song_link_imports where source_key=p_source_key;
  if v_mapped is not null and p_existing_song_id is not null and v_mapped<>p_existing_song_id then raise exception 'Linkul este deja asociat altei cântări. Reîncarcă preview-ul.'; end if;
  v_song:=coalesce(v_mapped,p_existing_song_id);
  if v_song is null then
    select r.song_id into v_song from public.external_song_refs r join public.songs s on s.id=r.song_id
    where s.is_active and 'resursecrestine:'||substring(r.external_url from '/cantece/([0-9]+)')=p_source_key order by r.created_at limit 1;
  end if;
  if v_song is null then
    v_song:=public.import_song_with_sections(v_collections[1],trim(p_title),nullif(trim(p_song_number),''),p_lyrics,p_sections,
      trim(p_title)||'.url','other','Import din link, verificat în preview. Sursa: '||p_url,null,null,p_structure,p_notes,null);
    v_new:=true;
    select id into v_file from public.song_files where song_id=v_song order by created_at desc limit 1;
  else
    perform id from public.songs where id=v_song for update;
    if not exists(select 1 from public.songs where id=v_song and is_active) then raise exception 'Cântarea existentă nu mai este activă.'; end if;
  end if;
  foreach v_collection in array v_collections loop
    if not exists(select 1 from public.song_sources where song_id=v_song and collection_id=v_collection) then
      insert into public.song_sources(song_id,collection_id,song_number,source_title,source_file_id)
      values(v_song,v_collection,nullif(trim(p_song_number),''),(select title from public.songs where id=v_song),v_file);
      v_linked:=v_linked+1;
    end if;
  end loop;
  insert into public.song_link_imports(source_key,source_url,song_id,imported_by) values(p_source_key,p_url,v_song,auth.uid())
  on conflict(source_key) do nothing;
  return jsonb_build_object('songId',v_song,'created',v_new,'collectionsAdded',v_linked+case when v_new then 1 else 0 end);
end $$;

create or replace function public.find_duplicate_song_candidates(p_limit integer default 50)
returns table (
  group_key text,
  title_hint text,
  song_count integer,
  songs jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with normalized as (
    select
      s.id,
      s.title,
      s.default_key,
      s.bpm,
      s.created_at,
      public.normalize_song_title_for_duplicates(s.title) as group_key,
      coalesce(string_agg(distinct c.name, ', ' order by c.name), '') as collections,
      coalesce(string_agg(distinct ss.song_number, ', ' order by ss.song_number) filter (where ss.song_number is not null and ss.song_number <> ''), '') as numbers,
      length(coalesce(s.lyrics_text, '')) as lyrics_length
    from public.songs s
    left join public.song_sources ss on ss.song_id = s.id
    left join public.song_collections c on c.id = ss.collection_id
    where s.is_active
    group by s.id
  ), grouped as (
    select
      n.group_key,
      min(n.title) as title_hint,
      count(*)::integer as song_count,
      jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'title', n.title,
          'default_key', n.default_key,
          'bpm', n.bpm,
          'created_at', n.created_at,
          'collections', n.collections,
          'numbers', n.numbers,
          'lyrics_length', n.lyrics_length
        ) order by n.lyrics_length desc, n.created_at asc
      ) as songs
    from normalized n
    where length(n.group_key) >= 4
    group by n.group_key
    having count(*) > 1
  )
  select g.group_key, g.title_hint, g.song_count, g.songs
  from grouped g
  order by g.song_count desc, g.title_hint asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;


notify pgrst,'reload schema';
commit;
