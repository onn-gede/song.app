-- După v64, pe aceeași bază. Nu repară automat versurile.
begin;
-- Add restrictive write guards even if a legacy permissive profile policy remains.
drop policy if exists profiles_insert_admin_v65 on public.profiles;
create policy profiles_insert_admin_v65 on public.profiles as restrictive for insert to authenticated with check(public.is_admin());
drop policy if exists profiles_update_admin_v65 on public.profiles;
create policy profiles_update_admin_v65 on public.profiles as restrictive for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists profiles_delete_admin_v65 on public.profiles;
create policy profiles_delete_admin_v65 on public.profiles as restrictive for delete to authenticated using(public.is_admin());

create table if not exists public.song_usage_exclusions_v65(
 song_id uuid not null references public.songs(id) on delete cascade,meeting_id uuid not null references public.meetings(id) on delete cascade,
 reason text not null default '',created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),primary key(song_id,meeting_id));
alter table public.song_usage_exclusions_v65 enable row level security;
revoke all on public.song_usage_exclusions_v65 from public,anon,authenticated;
grant select on public.song_usage_exclusions_v65 to authenticated;
grant all on public.song_usage_exclusions_v65 to service_role;
drop policy if exists usage_exclusions_read_v65 on public.song_usage_exclusions_v65;
create policy usage_exclusions_read_v65 on public.song_usage_exclusions_v65 for select to authenticated using(public.current_user_role() is not null);
create or replace view public.song_performance_occurrences_v46 with(security_invoker=true) as
 select distinct mi.song_id,m.id as meeting_id,m.title as meeting_title,m.meeting_date,m.meeting_type
 from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
 where mi.song_id is not null and not mi.is_backup and not m.is_template and m.meeting_date<=now()
 and not exists(select 1 from public.song_usage_exclusions_v65 e where e.song_id=mi.song_id and e.meeting_id=m.id);
revoke all on public.song_performance_occurrences_v46 from public,anon;
grant select on public.song_performance_occurrences_v46 to authenticated;
create or replace function public.set_song_usage_exclusion_v65(p_song uuid,p_meetings uuid[],p_excluded boolean,p_reason text default '') returns boolean language plpgsql security definer set search_path=public as $$
declare mid uuid;begin
 if not public.can_edit_content() then raise exception 'Doar persoanele cu drept de editare pot corecta istoricul.' using errcode='42501';end if;
 if p_excluded is null or coalesce(cardinality(p_meetings),0) not between 1 and 100 or length(coalesce(p_reason,''))>500 then raise exception 'Selecție invalidă.';end if;
 foreach mid in array p_meetings loop
 if p_excluded then
 if not exists(select 1 from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id where mi.song_id=p_song and m.id=mid and not mi.is_backup and not m.is_template and m.meeting_date<=now()) then raise exception 'Cântarea nu este în lista principală a acestui program trecut/în curs.';end if;
 insert into public.song_usage_exclusions_v65(song_id,meeting_id,reason,created_by) values(p_song,mid,coalesce(p_reason,''),auth.uid()) on conflict(song_id,meeting_id) do update set reason=excluded.reason,created_by=excluded.created_by,created_at=now();
 else delete from public.song_usage_exclusions_v65 where song_id=p_song and meeting_id=mid;end if;
 end loop;
 insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id,details) values(auth.uid(),case when p_excluded then 'usage.exclude' else 'usage.restore' end,'songs',p_song::text,jsonb_build_object('meeting_ids',p_meetings,'count',cardinality(p_meetings)));
 return true;
end $$;
revoke all on function public.set_song_usage_exclusion_v65(uuid,uuid[],boolean,text) from public,anon;
grant execute on function public.set_song_usage_exclusion_v65(uuid,uuid[],boolean,text) to authenticated;

create or replace function public.get_song_history_v46(p_song_id uuid,p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security invoker set search_path=public as $$
with uses as materialized (
 select distinct mi.song_id,m.id as meeting_id,m.title as meeting_title,m.meeting_date,m.meeting_type,(m.meeting_date>now()) as is_future,
 exists(select 1 from public.song_usage_exclusions_v65 e where e.song_id=mi.song_id and e.meeting_id=m.id) as is_excluded
 from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id where mi.song_id=p_song_id and not mi.is_backup and not m.is_template
), rows as (select * from uses order by meeting_date desc,meeting_id limit least(greatest(coalesce(p_page_size,30),1),100) offset (greatest(coalesce(p_page,1),1)::bigint-1)*least(greatest(coalesce(p_page_size,30),1),100))
select jsonb_build_object('total',(select count(*) from uses),'performed_total',(select count(*) from uses where not is_future and not is_excluded),
 'upcoming_total',(select count(*) from uses where is_future),'last_used_at',(select max(meeting_date) from uses where not is_future and not is_excluded),
 'entries',coalesce((select jsonb_agg(to_jsonb(rows) order by meeting_date desc,meeting_id) from rows),'[]'::jsonb));
$$;
-- An excluded past use is omitted from scheduling warnings, too. Other occurrences remain.
create or replace function public.song_program_events_v52(p_song_id uuid,p_exclude_meeting uuid default null)
returns table(meeting_id uuid,meeting_title text,meeting_date timestamptz,is_backup boolean,phase text)
language sql stable security invoker set search_path=public as $$
 select m.id,m.title,m.meeting_date,bool_and(mi.is_backup),case when m.meeting_date>now() then 'planned' when m.meeting_date+interval '2 hours'>now() then 'in_progress' else 'finished' end
 from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
 where mi.song_id=p_song_id and not m.is_template and (p_exclude_meeting is null or m.id<>p_exclude_meeting)
 and (m.status<>'archived' or m.meeting_date+interval '2 hours'<=now())
 and not exists(select 1 from public.song_usage_exclusions_v65 e where e.song_id=mi.song_id and e.meeting_id=m.id and m.meeting_date<=now()) group by m.id;
$$;

-- Public discovery returns only the next already published, unexpired link.
create or replace function public.next_public_program_v65() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('title',m.title,'date',m.meeting_date,'slug',l.public_slug)
 from public.meetings m join lateral(select public_slug from public.meeting_share_links where meeting_id=m.id and is_active and (expires_at is null or expires_at>now()) order by created_at desc,id limit 1) l on true
 where not m.is_template and m.status<>'archived' and m.meeting_date+interval '2 hours'>now()
 order by m.meeting_date,m.id limit 1;
$$;
revoke all on function public.next_public_program_v65() from public;
grant execute on function public.next_public_program_v65() to anon,authenticated;
create or replace function public.move_program_item_v65(p_meeting uuid,p_item uuid,p_backup boolean,p_before uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 perform public.place_meeting_item_v45(p_meeting,p_item,p_backup,p_before);
 return public.get_meeting_snapshot_v46(p_meeting);
end $$;
revoke all on function public.move_program_item_v65(uuid,uuid,boolean,uuid) from public,anon;
grant execute on function public.move_program_item_v65(uuid,uuid,boolean,uuid) to authenticated;

-- Lyric repair is previewed explicitly: a title is not necessarily a lyric.
create table if not exists public.youth_lyric_repairs_v65(
 id uuid primary key default gen_random_uuid(),song_id uuid not null references public.songs(id) on delete cascade,section_id uuid references public.song_sections(id) on delete set null,
 previous_lyrics text,previous_content text,after_hash text not null,created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),reverted_at timestamptz);
alter table public.youth_lyric_repairs_v65 enable row level security;
revoke all on public.youth_lyric_repairs_v65 from public,anon,authenticated;
grant select on public.youth_lyric_repairs_v65 to authenticated;
grant all on public.youth_lyric_repairs_v65 to service_role;
drop policy if exists lyric_repairs_admin_read_v65 on public.youth_lyric_repairs_v65;
create policy lyric_repairs_admin_read_v65 on public.youth_lyric_repairs_v65 for select to authenticated using(public.is_admin());
create or replace function public.youth_lyric_candidates_v65() returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;begin
 if not public.is_admin() then raise exception 'Acces interzis.' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'number',src.song_number,'sectionId',v.id,'before',coalesce(v.content,s.lyrics_text),'after',s.title||E'\n'||coalesce(v.content,s.lyrics_text),
 'hash',md5(jsonb_build_array(s.title,s.lyrics_text,v.id,v.content)::text)) order by src.song_number,s.title),'[]') into result
 from public.songs s join lateral(select ss.song_number from public.song_sources ss join public.song_collections c on c.id=ss.collection_id where ss.song_id=s.id and (upper(c.short_code)='TINERI' or lower(c.name)='tineri') order by ss.id limit 1) src on true
 left join lateral(select id,content from public.song_sections where song_id=s.id and section_type='verse' order by position,id limit 1) v on true
 where s.is_active and length(trim(s.title))>=4 and nullif(trim(coalesce(v.content,s.lyrics_text)),'') is not null
 and public.normalize_song_title_for_duplicates(split_part(regexp_replace(coalesce(v.content,s.lyrics_text),'^[[:space:]]*[0-9]+[.): -]+','','i'),E'\n',1))<>public.normalize_song_title_for_duplicates(s.title)
 and not exists(select 1 from regexp_split_to_table(coalesce(v.content,s.lyrics_text),E'\n') ln where public.normalize_song_title_for_duplicates(regexp_replace(ln,'^[[:space:]]*[0-9]+[.): -]+','','i'))=public.normalize_song_title_for_duplicates(s.title))
 and not exists(select 1 from public.youth_lyric_repairs_v65 b where b.song_id=s.id and b.reverted_at is null);
 return result;
end $$;
revoke all on function public.youth_lyric_candidates_v65() from public,anon;
grant execute on function public.youth_lyric_candidates_v65() to authenticated;
create or replace function public.repair_youth_lyrics_v65(p_rows jsonb) returns integer language plpgsql security definer set search_path=public as $$
declare r jsonb;c jsonb;s public.songs;sec public.song_sections;new_lyrics text;new_content text;n integer:=0;begin
 if not public.is_admin() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 100 then raise exception 'Selectează între 1 și 100 de cântări.';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
 select * into s from public.songs where id=(r->>'id')::uuid for update;
 if s.id is null then raise exception 'Cântarea nu mai există.';end if;
 perform 1 from public.song_sections where song_id=s.id for update;
 select value into c from jsonb_array_elements(public.youth_lyric_candidates_v65()) where value->>'id'=s.id::text;
 if c is null or c->>'hash' is distinct from r->>'hash' then raise exception 'Versuri modificate între timp sau cântare deja reparată. Reîncarcă preview-ul.';end if;
 sec:=null;if c->>'sectionId' is not null then select * into sec from public.song_sections where id=(c->>'sectionId')::uuid;end if;
 new_content:=c->>'after';
 if sec.id is not null then
 update public.song_sections set content=new_content where id=sec.id;
 select string_agg(content,E'\n\n' order by position,id) into new_lyrics from public.song_sections where song_id=s.id;
 else new_lyrics:=new_content;end if;
 update public.songs set lyrics_text=new_lyrics where id=s.id;
 insert into public.youth_lyric_repairs_v65(song_id,section_id,previous_lyrics,previous_content,after_hash,created_by) values(s.id,sec.id,s.lyrics_text,sec.content,md5(jsonb_build_array(new_lyrics,(select coalesce(jsonb_agg(jsonb_build_array(id,content) order by position,id),'[]') from public.song_sections where song_id=s.id))::text),auth.uid());n:=n+1;
 end loop;
 insert into public.activity_log_v48(actor_id,event_type,resource_type,details) values(auth.uid(),'lyrics.repair','songs',jsonb_build_object('count',n));return n;
end $$;
revoke all on function public.repair_youth_lyrics_v65(jsonb) from public,anon;
grant execute on function public.repair_youth_lyrics_v65(jsonb) to authenticated;
create or replace function public.undo_youth_lyrics_v65(p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare b public.youth_lyric_repairs_v65;lyrics text;content text;begin
 if not public.is_admin() then raise exception 'Acces interzis.' using errcode='42501';end if;
 select * into b from public.youth_lyric_repairs_v65 where id=p_id for update;
 if b.id is null or b.reverted_at is not null then raise exception 'Reparația nu mai poate fi anulată.';end if;
 select lyrics_text into lyrics from public.songs where id=b.song_id for update;
 if b.section_id is not null then select sc.content into content from public.song_sections sc where sc.id=b.section_id for update;else content:=lyrics;end if;
 if md5(jsonb_build_array(lyrics,(select coalesce(jsonb_agg(jsonb_build_array(id,sc.content) order by position,id),'[]') from public.song_sections sc where song_id=b.song_id))::text)<>b.after_hash then raise exception 'Cântarea a fost editată ulterior. Nu suprascriem modificările manuale.';end if;
 update public.songs set lyrics_text=b.previous_lyrics where id=b.song_id;
 if b.section_id is not null then update public.song_sections set content=b.previous_content where id=b.section_id;end if;
 update public.youth_lyric_repairs_v65 set reverted_at=now() where id=b.id;
 insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id) values(auth.uid(),'lyrics.undo','songs',b.song_id::text);return true;
end $$;
revoke all on function public.undo_youth_lyrics_v65(uuid) from public,anon;
grant execute on function public.undo_youth_lyrics_v65(uuid) to authenticated;
-- Include corrections in full backups and restore exclusions after their parent programs.
create or replace function public.backup_tables_v64() returns text[] language sql immutable as $$
 select array['song_collections','songs','categories','bible_versions','bible_books','bible_verses','bible_references','song_files','song_sources','song_sections','song_categories','song_bible_references','meetings','meeting_items','meeting_share_links','public_meeting_contributions','external_sources','external_song_refs','song_link_imports','youth_key_reference_v46','youth_key_applied_v46','song_usage_exclusions_v65','youth_lyric_repairs_v65'];
$$;
revoke all on function public.backup_tables_v64() from public,anon,authenticated;
commit;
