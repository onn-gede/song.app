begin;
alter table public.song_collections add column if not exists presentation_collection_v58 boolean not null default false;
alter table public.song_collections add column if not exists presentation_catalog_key_v58 text;
create unique index if not exists presentation_catalog_key_v58 on public.song_collections(presentation_catalog_key_v58) where presentation_catalog_key_v58 is not null;
alter table public.song_files add column if not exists presentation_only_v58 boolean not null default false;
alter table public.song_files add column if not exists source_number_v58 text;
alter table public.song_files add column if not exists sha256_v58 text;
alter table public.song_files add column if not exists preview_sha256_v58 text;
alter table public.song_files add column if not exists preview_path_v58 text;
alter table public.song_files add column if not exists upload_complete_v58 boolean not null default false;
create unique index if not exists presentation_number_v58 on public.song_files(collection_id,source_number_v58) where presentation_only_v58;
update storage.buckets set allowed_mime_types=(select array_agg(distinct v) from unnest(coalesce(allowed_mime_types,array[]::text[])||array['application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/pdf']) v) where id='song-files';
create or replace function public.presentation_collection_v58(p_collection_id uuid default null,p_name text default 'Cartea Neagră - Cântările Evangheliei · PPT') returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid;ids uuid[];code text;
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_collection_id is not null then
  select id into cid from public.song_collections where id=p_collection_id and is_active;
  if cid is null then raise exception 'Colecția nu este disponibilă.';end if;
 else
  if length(trim(coalesce(p_name,''))) not between 1 and 200 then raise exception 'Numele colecției este obligatoriu.';end if;
  perform pg_advisory_xact_lock(hashtextextended('presentations-v58:'||trim(p_name),0));
  select array_agg(id) into ids from public.song_collections where is_active and ((trim(p_name)='Cartea Neagră - Cântările Evangheliei · PPT' and presentation_catalog_key_v58='black-book-ppt') or (trim(p_name)<>'Cartea Neagră - Cântările Evangheliei · PPT' and presentation_collection_v58 and name=trim(p_name)));
  if cardinality(ids)>1 then raise exception 'Mai multe colecții corespondente. Alege explicit destinația.';end if;
  if cardinality(ids)=1 then cid:=ids[1];else
   code:=case when trim(p_name)='Cartea Neagră - Cântările Evangheliei · PPT' and not exists(select 1 from public.song_collections where short_code='CN_PPT') then 'CN_PPT' else 'PPT_'||left(replace(gen_random_uuid()::text,'-',''),12) end;
   insert into public.song_collections(name,short_code,source_type,is_active,color,presentation_collection_v58,presentation_catalog_key_v58) values(trim(p_name),code,'ppt',true,'#334155',true,case when trim(p_name)='Cartea Neagră - Cântările Evangheliei · PPT' then 'black-book-ppt' else null end) returning id into cid;
  end if;
 end if;
 return (select jsonb_build_object('id',id,'name',name) from public.song_collections where id=cid);
end $$;
revoke all on function public.presentation_collection_v58(uuid,text) from public,anon;
grant execute on function public.presentation_collection_v58(uuid,text) to authenticated,service_role;
create or replace function public.register_presentation_v58(p_collection_id uuid,p_number text,p_title text,p_file_name text,p_sha256 text,p_preview_sha256 text default null,p_first_line text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare num text;ext text;sid uuid;fid uuid;src uuid;ids uuid[];old public.song_files;original_path text;pdf_path text;result text:='existing';
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_number is null or p_number !~ '^[0-9]{1,4}$' or p_number::integer not between 1 and 9999 or length(trim(coalesce(p_title,''))) not between 1 and 300 or length(coalesce(p_file_name,'')) not between 1 and 240 or p_file_name ~ '[/\\]' then raise exception 'Număr, titlu sau nume de fișier invalid.';end if;
 ext:=lower(substring(p_file_name from '\.([^.]+)$'));
 if ext is null or ext not in ('ppt','pptx') or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or (p_preview_sha256 is not null and p_preview_sha256 !~ '^[a-f0-9]{64}$') then raise exception 'Format sau amprentă fișier invalidă.';end if;
 num:=lpad(p_number::integer::text,greatest(3,length(p_number::integer::text)),'0');
 perform 1 from public.song_collections where id=p_collection_id and is_active for update;
 if not found then raise exception 'Colecție indisponibilă.';end if;
 select * into old from public.song_files where collection_id=p_collection_id and presentation_only_v58 and source_number_v58=num for update;
 if found then sid:=old.song_id;fid:=old.id;
  if sid is null or not exists(select 1 from public.songs where id=sid and is_active) then raise exception 'Cântarea legată a fost eliminată sau dezactivată. Verifică manual corespondentul.';end if;
 else
  select array_agg(distinct s.id) into ids from public.songs s join public.song_sources ss on ss.song_id=s.id where ss.collection_id=p_collection_id and public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(num) and s.is_active and public.normalize_song_title_for_duplicates(s.title)=public.normalize_song_title_for_duplicates(p_title);
  if cardinality(ids)>1 then raise exception 'Mai multe cântări cu același număr și titlu. Unifică duplicatele înainte de import.';end if;
  if cardinality(ids)=1 then sid:=ids[1];result:='linked';else
   if exists(select 1 from public.song_sources ss join public.songs s on s.id=ss.song_id where ss.collection_id=p_collection_id and s.is_active and public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(num)) then raise exception 'Numărul % există cu alt titlu. Alege colecția PPT separată sau verifică manual ediția.',num;end if;
   insert into public.songs(title) values(trim(p_title)) returning id into sid;result:='created';
  end if;
 end if;
 select id into src from public.song_sources where song_id=sid and collection_id=p_collection_id and public.song_number_fold_v57(song_number)=public.song_number_fold_v57(num) order by created_at,id limit 1;
 if src is null then insert into public.song_sources(song_id,collection_id,song_number,source_title) values(sid,p_collection_id,num,p_file_name||case when nullif(trim(p_first_line),'') is null then '' else ' · '||left(trim(p_first_line),300) end) returning id into src;end if;
 if fid is not null and old.sha256_v58=p_sha256 and p_preview_sha256 is null then p_preview_sha256:=old.preview_sha256_v58;end if;
 original_path:='presentations/'||p_collection_id::text||'/'||num||'-'||p_sha256||'.'||ext;
 pdf_path:=case when p_preview_sha256 is null then null else 'presentations/'||p_collection_id::text||'/'||num||'-'||p_preview_sha256||'.pdf' end;
 if fid is null then
  insert into public.song_files(collection_id,song_id,file_name,file_type,storage_path,import_status,parser_notes,presentation_only_v58,source_number_v58,sha256_v58,preview_sha256_v58,preview_path_v58)
  values(p_collection_id,sid,p_file_name,ext::public.collection_source_type,original_path,'approved','Titlu și prezentare importate. Versurile nu au fost extrase.',true,num,p_sha256,p_preview_sha256,pdf_path) returning id into fid;
 else
  update public.song_files set file_name=p_file_name,file_type=ext::public.collection_source_type,storage_path=original_path,preview_path_v58=pdf_path,sha256_v58=p_sha256,preview_sha256_v58=p_preview_sha256,upload_complete_v58=case when sha256_v58 is not distinct from p_sha256 and preview_sha256_v58 is not distinct from p_preview_sha256 then upload_complete_v58 else false end where id=fid;
 end if;
 return (select jsonb_build_object('status',result,'songId',sid,'fileId',fid,'sourceId',src,'path',storage_path,'previewPath',preview_path_v58,'complete',upload_complete_v58) from public.song_files where id=fid);
end $$;
revoke all on function public.register_presentation_v58(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.register_presentation_v58(uuid,text,text,text,text,text,text) to authenticated,service_role;
create or replace function public.complete_presentation_v58(p_file_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare f public.song_files;
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 select * into f from public.song_files where id=p_file_id and presentation_only_v58 for update;
 if not found then raise exception 'Fișier inexistent.';end if;
 if not exists(select 1 from storage.objects where bucket_id='song-files' and name=f.storage_path) or (f.preview_path_v58 is not null and not exists(select 1 from storage.objects where bucket_id='song-files' and name=f.preview_path_v58)) then raise exception 'Încărcarea fișierelor nu este completă. Reia importul.';end if;
 update public.song_files set upload_complete_v58=true where id=f.id;
 return jsonb_build_object('fileId',f.id,'songId',f.song_id,'complete',true);
end $$;
revoke all on function public.complete_presentation_v58(uuid) from public,anon;
grant execute on function public.complete_presentation_v58(uuid) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
