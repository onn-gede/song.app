-- v43: Import by reviewed link. Existing songs, refs and collections are retained.
begin;
create table if not exists public.song_link_imports (
  source_key text primary key,
  source_url text not null,
  song_id uuid not null references public.songs(id) on delete cascade,
  imported_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.song_link_imports enable row level security;
drop policy if exists link_imports_active_read on public.song_link_imports;
create policy link_imports_active_read on public.song_link_imports for select to authenticated using(public.current_user_role() is not null);
grant select on public.song_link_imports to authenticated;
grant select,insert,update,delete on public.song_link_imports to service_role;
revoke insert,update,delete on public.song_link_imports from public,anon,authenticated;

-- Pending legacy work must not import more songs after switching workflows.
update public.external_sync_runs set status='cancelled',finished_at=now(),lease_token=null,lease_until=null,error_message='Sincronizare suspendată: importul se face acum din link, cu preview.'
where status in ('queued','running');

create or replace function public.find_link_song_matches(p_source_key text,p_title text)
returns jsonb language sql stable security invoker set search_path=public as $$
select coalesce(jsonb_agg(jsonb_build_object('songId',x.id,'title',x.title,'sourceMatch',x.source_match) order by x.source_match desc,x.title),'[]'::jsonb)
from (
  select s.id,s.title,
    (exists(select 1 from public.song_link_imports l where l.song_id=s.id and l.source_key=p_source_key)
    or exists(select 1 from public.external_song_refs r where r.song_id=s.id and 'resursecrestine:'||substring(r.external_url from '/cantece/([0-9]+)')=p_source_key)) as source_match
  from public.songs s where s.is_active and (
    public.normalize_song_title_for_duplicates(s.title)=public.normalize_song_title_for_duplicates(p_title)
    or exists(select 1 from public.song_link_imports l where l.song_id=s.id and l.source_key=p_source_key)
    or exists(select 1 from public.external_song_refs r where r.song_id=s.id and 'resursecrestine:'||substring(r.external_url from '/cantece/([0-9]+)')=p_source_key)
  ) order by source_match desc,s.title,s.id limit 20
) x;
$$;

create or replace function public.import_reviewed_song_link(
  p_source_key text,p_url text,p_title text,p_lyrics text,p_sections jsonb,
  p_collection_ids uuid[],p_existing_song_id uuid default null,p_notes text default null,
  p_structure text default null,p_song_number text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_song uuid; v_mapped uuid; v_collection uuid; v_file uuid; v_new boolean:=false; v_collections uuid[]; v_linked integer:=0;
begin
  if not public.can_edit_content() then raise exception 'Nu ai permisiunea pentru import.' using errcode='42501'; end if;
  if p_source_key !~ '^resursecrestine:[0-9]+$' or p_source_key is null
    or p_url !~ '^https://www\.resursecrestine\.ro/cantece/[0-9]+/[^/?#]+$'
    or p_url is null or p_source_key <> 'resursecrestine:'||substring(p_url from '/cantece/([0-9]+)') then raise exception 'Link invalid.'; end if;
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
revoke execute on function public.find_link_song_matches(text,text) from public,anon;
revoke execute on function public.import_reviewed_song_link(text,text,text,text,jsonb,uuid[],uuid,text,text,text) from public,anon;
grant execute on function public.find_link_song_matches(text,text) to authenticated;
grant execute on function public.import_reviewed_song_link(text,text,text,text,jsonb,uuid[],uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
