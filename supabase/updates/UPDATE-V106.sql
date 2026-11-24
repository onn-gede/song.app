-- Actualizare v106 peste v104/v105. Programele devin publice implicit, cu oprire/reactivare, și adaugă repararea punctuală a primului vers.
begin;

-- Programele reale sunt publicabile imediat. Șabloanele rămân private.
create or replace function public.ensure_meeting_public_link_v106()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_base text;
  v_slug text;
begin
  if new.is_template then
    update public.meeting_share_links
       set is_active=false
     where meeting_id=new.id and is_active;
    return new;
  end if;

  -- Nu reactivăm un program făcut privat în mod explicit.
  if exists(select 1 from public.meeting_share_links where meeting_id=new.id) then
    return new;
  end if;

  v_base:=lower(public.unaccent(coalesce(nullif(trim(new.title),''),'program')));
  v_base:=trim(both '-' from regexp_replace(v_base,'[^a-z0-9]+','-','g'));
  if length(v_base)<3 then v_base:='program'; end if;
  v_slug:=left(v_base,70)||'-'||substr(replace(new.id::text,'-',''),1,10);

  insert into public.meeting_share_links(meeting_id,public_slug,is_active,created_by)
  values(new.id,v_slug,true,new.created_by)
  on conflict(public_slug) do nothing;

  if not found then
    insert into public.meeting_share_links(meeting_id,public_slug,is_active,created_by)
    values(new.id,left(v_base,64)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,16),true,new.created_by);
  end if;
  return new;
end $$;

drop trigger if exists ensure_meeting_public_link_v106 on public.meetings;
create trigger ensure_meeting_public_link_v106
after insert or update of is_template on public.meetings
for each row execute function public.ensure_meeting_public_link_v106();

-- Publică programele existente care nu au avut niciodată link. Un link dezactivat
-- este considerat alegere explicită de confidențialitate și nu este reactivat.
insert into public.meeting_share_links(meeting_id,public_slug,is_active,created_by)
select m.id,
       left(coalesce(nullif(trim(both '-' from regexp_replace(lower(public.unaccent(m.title)),'[^a-z0-9]+','-','g')),''),'program'),70)
         ||'-'||substr(replace(m.id::text,'-',''),1,10),
       true,
       m.created_by
from public.meetings m
where not m.is_template
  and not exists(select 1 from public.meeting_share_links l where l.meeting_id=m.id)
on conflict(public_slug) do nothing;

create or replace function public.set_meeting_public_v106(p_meeting uuid,p_public boolean)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_link public.meeting_share_links;
  v_title text;
  v_base text;
begin
  if not public.can_edit_content() then
    raise exception 'Acces interzis.' using errcode='42501';
  end if;
  if p_meeting is null or p_public is null then raise exception 'Setare invalidă.'; end if;
  select title into v_title from public.meetings where id=p_meeting and not is_template;
  if v_title is null then raise exception 'Programul nu există sau este șablon.'; end if;

  if not p_public then
    update public.meeting_share_links set is_active=false where meeting_id=p_meeting and is_active;
    insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id,details)
    values(auth.uid(),'meeting.private','meetings',p_meeting::text,jsonb_build_object('public',false));
    return null;
  end if;

  select * into v_link
    from public.meeting_share_links
   where meeting_id=p_meeting
   order by is_active desc,created_at desc,id
   limit 1
   for update;

  if v_link.id is not null then
    update public.meeting_share_links
       set is_active=true,expires_at=null
     where id=v_link.id
     returning * into v_link;
  else
    v_base:=trim(both '-' from regexp_replace(lower(public.unaccent(v_title)),'[^a-z0-9]+','-','g'));
    if length(v_base)<3 then v_base:='program'; end if;
    insert into public.meeting_share_links(meeting_id,public_slug,is_active,created_by)
    values(p_meeting,left(v_base,70)||'-'||substr(replace(p_meeting::text,'-',''),1,10),true,auth.uid())
    returning * into v_link;
  end if;

  insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id,details)
  values(auth.uid(),'meeting.public','meetings',p_meeting::text,jsonb_build_object('public',true,'slug',v_link.public_slug));
  return v_link.public_slug;
end $$;
revoke all on function public.set_meeting_public_v106(uuid,boolean) from public,anon;
grant execute on function public.set_meeting_public_v106(uuid,boolean) to authenticated;

-- Preview punctual pentru corectarea primului vers. Este disponibil editorilor,
-- dar nu modifică nimic până la confirmarea explicită.
create or replace function public.youth_lyric_candidate_v106(p_song uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare v_result jsonb;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  select jsonb_build_object(
    'id',s.id,'title',s.title,'number',src.song_number,'sectionId',v.id,
    'before',coalesce(v.content,s.lyrics_text),'after',s.title||E'\n'||coalesce(v.content,s.lyrics_text),
    'hash',md5(jsonb_build_array(s.title,s.lyrics_text,v.id,v.content)::text)
  ) into v_result
  from public.songs s
  join lateral(
    select ss.song_number
      from public.song_sources ss
      join public.song_collections c on c.id=ss.collection_id
     where ss.song_id=s.id and (upper(c.short_code)='TINERI' or lower(c.name)='tineri')
     order by ss.id limit 1
  ) src on true
  left join lateral(
    select id,content from public.song_sections
     where song_id=s.id and section_type='verse'
     order by position,id limit 1
  ) v on true
  where s.id=p_song and s.is_active and length(trim(s.title))>=4
    and nullif(trim(coalesce(v.content,s.lyrics_text)),'') is not null
    and public.normalize_song_title_for_duplicates(split_part(regexp_replace(coalesce(v.content,s.lyrics_text),'^[[:space:]]*[0-9]+[.): -]+','','i'),E'\n',1))
        <>public.normalize_song_title_for_duplicates(s.title)
    and not exists(
      select 1 from regexp_split_to_table(coalesce(v.content,s.lyrics_text),E'\n') ln
       where public.normalize_song_title_for_duplicates(regexp_replace(ln,'^[[:space:]]*[0-9]+[.): -]+','','i'))
             =public.normalize_song_title_for_duplicates(s.title)
    )
    and not exists(
      select 1 from public.youth_lyric_repairs_v65 b where b.song_id=s.id and b.reverted_at is null
    );
  return v_result;
end $$;
revoke all on function public.youth_lyric_candidate_v106(uuid) from public,anon;
grant execute on function public.youth_lyric_candidate_v106(uuid) to authenticated;

create or replace function public.repair_youth_lyric_v106(p_song uuid,p_hash text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_candidate jsonb;
  v_song public.songs;
  v_section public.song_sections;
  v_previous_lyrics text;
  v_previous_content text;
  v_new_lyrics text;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  select * into v_song from public.songs where id=p_song for update;
  if v_song.id is null then raise exception 'Cântarea nu mai există.'; end if;
  perform 1 from public.song_sections where song_id=p_song for update;
  v_candidate:=public.youth_lyric_candidate_v106(p_song);
  if v_candidate is null or v_candidate->>'hash' is distinct from p_hash then
    raise exception 'Versurile au fost modificate sau nu mai necesită această corectare.';
  end if;

  v_previous_lyrics:=v_song.lyrics_text;
  if nullif(v_candidate->>'sectionId','') is not null then
    select * into v_section from public.song_sections where id=(v_candidate->>'sectionId')::uuid;
    v_previous_content:=v_section.content;
    update public.song_sections set content=v_candidate->>'after' where id=v_section.id;
    select string_agg(content,E'\n\n' order by position,id) into v_new_lyrics
      from public.song_sections where song_id=p_song;
  else
    v_new_lyrics:=v_candidate->>'after';
  end if;

  update public.songs set lyrics_text=v_new_lyrics where id=p_song;
  insert into public.youth_lyric_repairs_v65(
    song_id,section_id,previous_lyrics,previous_content,after_hash,created_by
  ) values(
    p_song,v_section.id,v_previous_lyrics,v_previous_content,
    md5(jsonb_build_array(v_new_lyrics,(select coalesce(jsonb_agg(jsonb_build_array(id,content) order by position,id),'[]') from public.song_sections where song_id=p_song))::text),
    auth.uid()
  );
  insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id,details)
  values(auth.uid(),'lyrics.repair','songs',p_song::text,jsonb_build_object('count',1,'mode','single'));
  return true;
end $$;
revoke all on function public.repair_youth_lyric_v106(uuid,text) from public,anon;
grant execute on function public.repair_youth_lyric_v106(uuid,text) to authenticated;

commit;
