begin;
-- Private recovery copies: old lyrics/sections and source identity before any book repair.
create table if not exists public.book_repair_backups_v57(
 id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),actor_id uuid,category text not null,song_id uuid not null,old_song jsonb not null,old_sections jsonb not null,old_source jsonb,reason text not null
);
alter table public.book_repair_backups_v57 enable row level security;
revoke all on public.book_repair_backups_v57 from public,anon,authenticated;
create or replace function public.book_collection_v57(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare ids uuid[];cid uuid;
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_code='cr' then return public.red_book_collection_v55();end if;
 if p_code is distinct from 'cn' then raise exception 'Categorie nepermisă.';end if;
 perform pg_advisory_xact_lock(hashtextextended('songapp-book-cn-v57',0));
 select array_agg(id) into ids from public.song_collections where public.normalize_song_title_for_duplicates(name) in ('carteaneagracantarileevangheliei','carteneagracantarileevangheliei','cantarileevanghelieicarteaneagra','cantarileevanghelieicarteneagra');
 if cardinality(ids)>1 then raise exception 'Mai multe colecții Carte Neagră: unifică destinația înainte de import.';end if;
 if cardinality(ids)=1 then cid:=ids[1];else
  insert into public.song_collections(name,short_code,source_type,is_active,color) values('Cartea Neagră - Cântările Evangheliei',case when exists(select 1 from public.song_collections where short_code='CN') then 'CN_IMPORT_V57' else 'CN' end,'ppt',true,'#334155') returning id into cid;
 end if;
 return (select jsonb_build_object('id',id,'name',name) from public.song_collections where id=cid);
end $$;
revoke all on function public.book_collection_v57(text) from public,anon;
grant execute on function public.book_collection_v57(text) to authenticated,service_role;
create or replace function public.upsert_book_song_v57(p_code text,p_title text,p_number text,p_lyrics text,p_sections jsonb,p_source_ids jsonb,p_url text) returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid;sid uuid;prior uuid;ids uuid[];src public.song_sources;old public.songs;sec jsonb;x jsonb;source_id text;pos integer:=0;changed boolean:=false;result text:='existing';
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_code not in ('cr','cn') or p_code is null or length(trim(coalesce(p_title,''))) not between 1 and 300 or length(trim(coalesce(p_lyrics,''))) not between 20 and 100000 or (p_number is not null and p_number !~ '^[0-9]{1,4}$') then raise exception 'Date cântare invalide.';end if;
 if p_code='cr' and (p_number is null or p_number::integer not between 1 and 601) then raise exception 'Număr Carte Roșie invalid.';end if;
 if jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections) not between 1 and 300 or jsonb_typeof(p_source_ids) is distinct from 'array' or jsonb_array_length(p_source_ids) not between 1 and 10 then raise exception 'Structură invalidă.';end if;
 if p_url is null or p_url !~ '^https://(www\.)?cantaricrestine\.ro/[^?#]+$' then raise exception 'Sursă invalidă.';end if;
 for source_id in select jsonb_array_elements_text(p_source_ids) loop if source_id !~ '^[0-9]{1,20}$' then raise exception 'ID sursă invalid.';end if;end loop;
 for x in select value from jsonb_array_elements(p_sections) loop
  if x->>'section_type' not in ('verse','chorus','bridge','intro','outro','prechorus','ending','other') or nullif(trim(x->>'content'),'') is null then raise exception 'Strofă invalidă.';end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended('songapp-book-'||p_code||'-v57',0));
 cid:=(public.book_collection_v57(p_code)->>'id')::uuid;
 select array_agg(distinct ss.song_id) into ids from public.song_sources ss join public.song_link_imports li on li.song_id=ss.song_id where ss.collection_id=cid and li.source_key in(select 'cantaricrestine:'||p_code||':'||jsonb_array_elements_text(p_source_ids));
 if cardinality(ids)>1 then return jsonb_build_object('status','review','reason','Identități sursă conflictuale.');end if;
 if cardinality(ids)=1 then sid:=ids[1];end if;
 if p_number is not null then
  select array_agg(distinct song_id) into ids from public.song_sources where collection_id=cid and public.song_number_fold_v57(song_number)=public.song_number_fold_v57(p_number);
  if cardinality(ids)>0 and sid is not null and not(sid=any(ids)) then return jsonb_build_object('status','review','reason','Identitatea sursei și numărul indică piese diferite.');end if;
  if sid is null and cardinality(ids)>0 then
   select s.id into sid from public.songs s where s.id=any(ids) and s.is_active order by (public.normalize_song_title_for_duplicates(s.title)=public.normalize_song_title_for_duplicates(p_title)) desc,s.created_at,s.id limit 1;
   if sid is null then return jsonb_build_object('status','review','reason','Corespondentele numărului sunt inactive.');end if;
  end if;
 end if;
 if sid is null then
  select array_agg(distinct s.id) into ids from public.songs s join public.song_sources ss on ss.song_id=s.id where ss.collection_id=cid and s.is_active and public.normalize_song_title_for_duplicates(s.title)=public.normalize_song_title_for_duplicates(p_title) and (p_number is null or nullif(ss.song_number,'') is null);
  if cardinality(ids)>0 then select id into sid from public.songs where id=any(ids) order by created_at,id limit 1;end if;
 end if;
 if sid is not null then
  select * into old from public.songs where id=sid for update;
  if not old.is_active then return jsonb_build_object('status','review','reason','Cântare inactivă; păstrată.');end if;
  select * into src from public.song_sources where song_id=sid and collection_id=cid order by case when p_number is not null and public.song_number_fold_v57(song_number)=public.song_number_fold_v57(p_number) then 0 else 1 end,created_at,id limit 1;
  select coalesce(jsonb_agg(to_jsonb(s) order by position,id),'[]') into sec from public.song_sections s where song_id=sid;
  changed:=old.lyrics_text is distinct from trim(p_lyrics) or old.title is distinct from trim(p_title) or
   (select coalesce(jsonb_agg(jsonb_build_object('content',v->>'content','section_type',v->>'section_type','section_label',v->>'section_label') order by (v->>'position')::integer),'[]') from jsonb_array_elements(sec) v)
   is distinct from (select jsonb_agg(jsonb_build_object('content',v->>'content','section_type',v->>'section_type','section_label',v->>'section_label') order by ord) from jsonb_array_elements(p_sections) with ordinality a(v,ord));
  if changed then
   insert into public.book_repair_backups_v57(actor_id,category,song_id,old_song,old_sections,old_source,reason) values(auth.uid(),p_code,sid,to_jsonb(old),sec,to_jsonb(src),'Reparare autorizată din catalog API / slide-uri curente');
   -- Different books may use different versions of the same hymn. Keep other collections intact.
   if exists(select 1 from public.song_sources where song_id=sid and (collection_id<>cid or (p_number is not null and nullif(song_number,'') is not null and public.song_number_fold_v57(song_number)<>public.song_number_fold_v57(p_number)))) then
    prior:=sid;
    insert into public.songs(title,lyrics_text,default_key,bpm,structure,notes) values(trim(p_title),trim(p_lyrics),old.default_key,old.bpm,old.structure,old.notes) returning id into sid;
    update public.song_sources set song_id=sid where id=src.id;
    update public.meeting_items set song_id=sid where selected_source_id=src.id and song_id=prior;
    update public.song_link_imports set song_id=sid where song_id=prior and source_key like 'cantaricrestine:'||p_code||':%';
   else update public.songs set title=trim(p_title),lyrics_text=trim(p_lyrics) where id=sid;end if;
   result:='repaired';
  end if;
 else
  insert into public.songs(title,lyrics_text) values(trim(p_title),trim(p_lyrics)) returning id into sid;changed:=true;result:='created';
 end if;
 if changed then
  delete from public.song_sections where song_id=sid;
  for x in select value from jsonb_array_elements(p_sections) loop pos:=pos+1;insert into public.song_sections(song_id,section_type,section_label,position,content) values(sid,x->>'section_type',x->>'section_label',pos,trim(x->>'content'));end loop;
 end if;
 if src.id is null then insert into public.song_sources(song_id,collection_id,song_number,source_title) values(sid,cid,p_number,'cantaricrestine.ro · '||p_code);else update public.song_sources set song_number=p_number where id=src.id;end if;
 for source_id in select jsonb_array_elements_text(p_source_ids) loop
  if exists(select 1 from public.song_link_imports where source_key='cantaricrestine:'||p_code||':'||source_id and song_id<>sid) then raise exception 'Identitate sursă ocupată: %',source_id;end if;
  insert into public.song_link_imports(source_key,source_url,song_id,imported_by) values('cantaricrestine:'||p_code||':'||source_id,p_url,sid,auth.uid()) on conflict(source_key) do nothing;
 end loop;
 return jsonb_build_object('status',result,'songId',sid,'collectionId',cid,'number',p_number);
end $$;
revoke all on function public.upsert_book_song_v57(text,text,text,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.upsert_book_song_v57(text,text,text,text,jsonb,jsonb,text) to authenticated,service_role;
create or replace function public.finalize_book_catalog_v57(p_code text,p_song_ids jsonb,p_expected integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid;archive uuid;ids uuid[];count_ids integer;src record;moved integer:=0;
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_code not in ('cr','cn') or p_code is null or jsonb_typeof(p_song_ids) is distinct from 'array' or p_expected<1 or (p_code='cr' and p_expected<>601) then raise exception 'Catalog invalid.';end if;
 select array_agg(distinct v::uuid) into ids from jsonb_array_elements_text(p_song_ids) v;
 if cardinality(ids) is distinct from p_expected then raise exception 'Catalog incomplet: arhivarea a fost oprită.';end if;
 cid:=(public.book_collection_v57(p_code)->>'id')::uuid;
 select count(distinct song_id) into count_ids from public.song_sources where collection_id=cid and song_id=any(ids);
 if count_ids<>p_expected then raise exception 'Import incomplet: arhivarea a fost oprită.';end if;
 if exists(select 1 from public.song_sources where collection_id=cid and not(song_id=any(ids))) then
  select id into archive from public.song_collections where short_code='ARCHIVE_'||upper(p_code)||'_V57' limit 1;
  if archive is null then insert into public.song_collections(name,short_code,source_type,is_active,color) values('Arhivă import anterior · '||upper(p_code),'ARCHIVE_'||upper(p_code)||'_V57','manual',false,'#64748b') returning id into archive;end if;
  for src in select * from public.song_sources where collection_id=cid and not(song_id=any(ids)) loop
   insert into public.book_repair_backups_v57(actor_id,category,song_id,old_song,old_sections,old_source,reason)
    select auth.uid(),p_code,s.id,to_jsonb(s),coalesce((select jsonb_agg(to_jsonb(x) order by x.position,x.id) from public.song_sections x where x.song_id=s.id),'[]'),to_jsonb(src),'Arhivare înregistrare veche din afara catalogului confirmat' from public.songs s where s.id=src.song_id;
   update public.song_sources set collection_id=archive where id=src.id;moved:=moved+1;
   if not exists(select 1 from public.song_sources where song_id=src.song_id and collection_id<>archive) then update public.songs set is_active=false where id=src.song_id;end if;
  end loop;
 end if;
 return jsonb_build_object('songs',count_ids,'archivedSources',moved);
end $$;
revoke all on function public.finalize_book_catalog_v57(text,jsonb,integer) from public,anon;
grant execute on function public.finalize_book_catalog_v57(text,jsonb,integer) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
