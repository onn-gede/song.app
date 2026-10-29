begin;
create index if not exists songs_import_title_v55 on public.songs(public.normalize_song_title_for_duplicates(title)) where is_active;
create or replace function public.red_book_collection_v55() returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; matches uuid[];
begin
 if not (coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('songapp-red-book-v55',0));
 select array_agg(id) into matches from public.song_collections where name='Cartea roșie - Cântările Evangheliei';
 if cardinality(matches)>1 then raise exception 'Există mai multe colecții cu numele destinației. Unifică-le înainte de import.';end if;
 if cardinality(matches)=1 then cid:=matches[1];end if;
 if cid is null then
  select array_agg(id) into matches from public.song_collections where public.normalize_song_title_for_duplicates(name) in ('cartearosiecantarileevangheliei','carterosiecantarileevangheliei','cantarileevanghelieicarterosie','cantarileevanghelieicartearosie');
  if cardinality(matches)>1 then raise exception 'Există mai multe colecții Carte roșie. Păstrează numele exact Cartea roșie - Cântările Evangheliei pentru destinația dorită.';end if;
  if cardinality(matches)=1 then cid:=matches[1];end if;
 end if;
 if cid is null then
  insert into public.song_collections(name,short_code,source_type,is_active,color) values('Cartea roșie - Cântările Evangheliei',case when exists(select 1 from public.song_collections where short_code='CR') then 'CR_IMPORT_V55' else 'CR' end,'ppt',true,'#b91c1c') returning id into cid;
 end if;
 return (select jsonb_build_object('id',id,'name',name,'color',color) from public.song_collections where id=cid);
end $$;
revoke all on function public.red_book_collection_v55() from public,anon;
grant execute on function public.red_book_collection_v55() to authenticated,service_role;

create or replace function public.import_red_book_song_v55(p_title text,p_number text,p_lyrics text,p_sections jsonb,p_source_ids jsonb,p_url text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; sid uuid; candidates uuid[]; linked_ids uuid[]; source_row public.song_sources; old_lyrics text; result text:='existing'; source_id text; section jsonb; section_count integer; filled boolean:=false;
begin
 if not (coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if length(trim(coalesce(p_title,''))) not between 1 and 300 or p_number is null or p_number !~ '^[0-9]{1,4}$' or p_number::integer not between 1 and 9999 then raise exception 'Titlu/număr invalid.';end if;
 if p_url is null or p_url !~ '^https://(www\.)?cantaricrestine\.ro/[^?#]+$' then raise exception 'Sursă invalidă.';end if;
 if jsonb_typeof(p_source_ids) is distinct from 'array' or jsonb_array_length(p_source_ids) not between 1 and 10 then raise exception 'ID sursă invalid.';end if;
 for source_id in select jsonb_array_elements_text(p_source_ids) loop if source_id !~ '^[0-9]{1,20}$' then raise exception 'ID sursă invalid.';end if;end loop;
 if jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections)>300 or length(coalesce(p_lyrics,''))>100000 then raise exception 'Versuri/structură invalidă.';end if;
 perform pg_advisory_xact_lock(hashtextextended('songapp-red-book-v55',0));
 cid:=(public.red_book_collection_v55()->>'id')::uuid;
 -- Source identity takes precedence over title; conflicting mappings need human review.
 select array_agg(distinct song_id) into linked_ids from public.song_link_imports where source_key in (select 'cantaricrestine:cr:'||jsonb_array_elements_text(p_source_ids));
 if cardinality(linked_ids)>1 then return jsonb_build_object('status','review','reason','ID-urile sursă sunt deja legate de cântări diferite.');end if;
 if cardinality(linked_ids)=1 then sid:=linked_ids[1];end if;
 -- Number alone never merges different titles.
 select array_agg(distinct ss.song_id) into candidates from public.song_sources ss where ss.collection_id=cid and ss.song_number ~ '^[0-9]+$' and ltrim(ss.song_number,'0')=ltrim(p_number,'0');
 if cardinality(candidates)>1 or (cardinality(candidates)=1 and sid is not null and sid<>candidates[1]) then return jsonb_build_object('status','review','reason','Numărul este deja asociat unor cântări diferite.');end if;
 if cardinality(candidates)=1 and sid is null then
  if public.normalize_song_title_for_duplicates((select title from public.songs where id=candidates[1]))<>public.normalize_song_title_for_duplicates(p_title) then return jsonb_build_object('status','review','reason','Numărul există cu alt titlu; datele existente au fost păstrate.');end if;
  sid:=candidates[1];
 end if;
 if sid is null then
  select array_agg(id) into candidates from public.songs where is_active and public.normalize_song_title_for_duplicates(title)=public.normalize_song_title_for_duplicates(p_title);
  if cardinality(candidates)>1 then return jsonb_build_object('status','review','reason','Mai multe cântări existente au același titlu.');end if;
  if cardinality(candidates)=1 then
   sid:=candidates[1];
   -- The book itself has distinct numbered songs with identical titles (019/044).
   -- Only distinguish automatically when the prior song was mapped by this importer,
   -- has a different book number AND different nonempty lyrics. Never renumber it.
   if exists(select 1 from public.song_link_imports where song_id=sid and source_key like 'cantaricrestine:cr:%')
    and exists(select 1 from public.song_sources where song_id=sid and collection_id=cid and song_number ~ '^[0-9]+$' and ltrim(song_number,'0')<>ltrim(p_number,'0'))
    and length(trim(coalesce(p_lyrics,'')))>=20
    and exists(select 1 from public.songs where id=sid and nullif(trim(lyrics_text),'') is not null and public.normalize_song_title_for_duplicates(lyrics_text)<>public.normalize_song_title_for_duplicates(p_lyrics)) then sid:=null;end if;
  end if;
 end if;
 if sid is not null then
  if not exists(select 1 from public.songs where id=sid and is_active) then return jsonb_build_object('status','review','reason','Cântarea existentă este inactivă.');end if;
  select * into source_row from public.song_sources where collection_id=cid and song_id=sid order by created_at,id limit 1;
  if found and nullif(trim(source_row.song_number),'') is not null and (source_row.song_number !~ '^[0-9]+$' or ltrim(source_row.song_number,'0')<>ltrim(p_number,'0')) then return jsonb_build_object('status','review','reason','Cântarea existentă are alt număr în colecție.');end if;
 end if;
 if sid is null then
  if length(trim(coalesce(p_lyrics,'')))<20 or jsonb_array_length(p_sections)=0 then return jsonb_build_object('status','review','reason','Versuri lipsă sau nerecuperate sigur din PowerPoint.');end if;
  insert into public.songs(title,lyrics_text) values(trim(p_title),trim(p_lyrics)) returning id into sid;result:='created';filled:=true;
 else
  select lyrics_text into old_lyrics from public.songs where id=sid for update;
  if nullif(trim(old_lyrics),'') is null and length(trim(coalesce(p_lyrics,'')))>=20 and jsonb_array_length(p_sections)>0 then update public.songs set lyrics_text=trim(p_lyrics) where id=sid;filled:=true;result:='filled';end if;
 end if;
 -- Existing nonempty lyrics, keys, notes and sections are never overwritten.
 if filled and not exists(select 1 from public.song_sections where song_id=sid) then
  section_count:=0;
  for section in select value from jsonb_array_elements(p_sections) loop
   if length(trim(coalesce(section->>'content','')))=0 then continue;end if;section_count:=section_count+1;
   insert into public.song_sections(song_id,section_type,section_label,position,content) values(sid,case when section->>'section_type' in ('verse','chorus','bridge','intro','outro','prechorus','ending','other') then section->>'section_type' else 'verse' end,section->>'section_label',section_count,section->>'content');
  end loop;
 end if;
 if source_row.id is null then
  insert into public.song_sources(song_id,collection_id,song_number,source_title) values(sid,cid,p_number,'cantaricrestine.ro · cr');if result='existing' then result:='linked';end if;
 elsif nullif(trim(source_row.song_number),'') is null then update public.song_sources set song_number=p_number where id=source_row.id;if result='existing' then result:='linked';end if;end if;
 for source_id in select jsonb_array_elements_text(p_source_ids) loop
  insert into public.song_link_imports(source_key,source_url,song_id,imported_by) values('cantaricrestine:cr:'||source_id,p_url,sid,auth.uid()) on conflict(source_key) do nothing;
 end loop;
 return jsonb_build_object('status',result,'songId',sid,'collectionId',cid,'number',p_number);
end $$;
revoke all on function public.import_red_book_song_v55(text,text,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.import_red_book_song_v55(text,text,text,jsonb,jsonb,text) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
