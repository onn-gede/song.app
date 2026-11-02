-- Pachet cumulativ peste v77. Include v78, v79 și v80; nu rula separat UPDATE-V78.sql sau UPDATE-V79.sql.
begin;
create table if not exists public.reusable_song_numbers_v78(collection_id uuid references public.song_collections(id) on delete cascade,number text not null,primary key(collection_id,number));
alter table public.reusable_song_numbers_v78 enable row level security;
revoke all on public.reusable_song_numbers_v78 from public,anon,authenticated;
grant all on public.reusable_song_numbers_v78 to service_role;
create or replace function public.release_song_number_v78() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' or old.collection_id is distinct from new.collection_id or old.song_number is distinct from new.song_number then
  if nullif(trim(old.song_number),'') is not null and exists(select 1 from public.song_collections where id=old.collection_id) then insert into public.reusable_song_numbers_v78 values(old.collection_id,old.song_number) on conflict do nothing;end if;
 end if;
 return null;
end $$;
drop trigger if exists release_song_number_v78 on public.song_sources;
create trigger release_song_number_v78 after delete or update of collection_id,song_number on public.song_sources for each row execute function public.release_song_number_v78();
create or replace function public.assign_song_source_number_v47() returns trigger language plpgsql security definer set search_path=public as $$
declare v_number text;v_next numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended(new.collection_id::text,47));
 if nullif(trim(new.song_number),'') is null then
  select r.number into v_number from public.reusable_song_numbers_v78 r where r.collection_id=new.collection_id and not exists(select 1 from public.song_sources s where s.collection_id=r.collection_id and ltrim(s.song_number,'0')=ltrim(r.number,'0') and s.id is distinct from new.id) order by length(r.number),r.number limit 1;
  if v_number is null then select coalesce(max(substring(song_number from '^[0-9]+')::numeric),0)+1 into v_next from public.song_sources where collection_id=new.collection_id and id is distinct from new.id;v_number:=v_next::text;end if;
  new.song_number:=v_number;
 end if;
 return new;
end $$;
create or replace function public.edit_song_source_v78(p_song uuid,p_source uuid,p_collection uuid,p_number text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if length(coalesce(p_number,''))>60 or not exists(select 1 from public.song_collections where id=p_collection and is_active) then raise exception 'Colecție sau număr invalid.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_collection::text,47));
 if exists(select 1 from public.song_sources where collection_id=p_collection and id<>p_source and nullif(trim(p_number),'') is not null and ltrim(song_number,'0')=ltrim(trim(p_number),'0')) then raise exception 'Numărul este deja folosit în această colecție.';end if;
 update public.song_sources set collection_id=p_collection,song_number=nullif(trim(p_number),'') where id=p_source and song_id=p_song;
 if not found then raise exception 'Apartenența la colecție nu mai există.';end if;
 update public.meetings set updated_at=now() where id in(select meeting_id from public.meeting_items where song_id=p_song);
end $$;
create or replace function public.delete_song_v78(p_song uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 perform 1 from public.songs where id=p_song for update;
 if not found then raise exception 'Cântarea nu mai există.';end if;
 delete from public.meeting_items where song_id=p_song;
 delete from public.song_files where song_id=p_song;
 delete from public.songs where id=p_song;
end $$;
revoke all on function public.edit_song_source_v78(uuid,uuid,uuid,text),public.delete_song_v78(uuid),public.release_song_number_v78() from public,anon;
grant execute on function public.edit_song_source_v78(uuid,uuid,uuid,text),public.delete_song_v78(uuid) to authenticated;
commit;

begin;

alter table public.meetings add column if not exists program_kind text not null default 'official';
alter table public.meetings add column if not exists last_modified_by uuid;
alter table public.meetings add column if not exists last_modified_at timestamptz not null default now();
update public.meetings set last_modified_by=coalesce(last_modified_by,created_by),last_modified_at=coalesce(updated_at,created_at,last_modified_at);
alter table public.meetings drop constraint if exists meetings_program_kind_v79;
alter table public.meetings add constraint meetings_program_kind_v79 check(program_kind in('official','rehearsal'));

create or replace function public.track_meeting_authorship_v79() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  new.created_by:=coalesce(new.created_by,auth.uid());
  new.last_modified_by:=coalesce(new.last_modified_by,new.created_by,auth.uid());
  new.last_modified_at:=coalesce(new.last_modified_at,now());
 elsif row(new.title,new.meeting_type,new.meeting_date,new.status,new.notes,new.principal_responsible,new.secondary_responsibles,new.is_template,new.program_kind)
       is distinct from row(old.title,old.meeting_type,old.meeting_date,old.status,old.notes,old.principal_responsible,old.secondary_responsibles,old.is_template,old.program_kind) then
  new.last_modified_by:=coalesce(auth.uid(),new.last_modified_by,old.last_modified_by);
  new.last_modified_at:=now();
 end if;
 return new;
end $$;
drop trigger if exists track_meeting_authorship_v79 on public.meetings;
create trigger track_meeting_authorship_v79 before insert or update on public.meetings for each row execute function public.track_meeting_authorship_v79();

create or replace function public.touch_program_items_v46() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op<>'INSERT' then update public.meetings set updated_at=now(),last_modified_by=coalesce(auth.uid(),last_modified_by),last_modified_at=now() where id=old.meeting_id;end if;
 if tg_op='INSERT' or (tg_op='UPDATE' and new.meeting_id<>old.meeting_id) then update public.meetings set updated_at=now(),last_modified_by=coalesce(auth.uid(),last_modified_by),last_modified_at=now() where id=new.meeting_id;end if;
 return null;
end $$;

create or replace function public.create_meeting_v79(
 p_request_id uuid,p_title text,p_meeting_type text,p_meeting_date timestamptz,p_notes text default null,
 p_program_kind text default 'official',p_song_id uuid default null,p_is_backup boolean default false,p_source_id uuid default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_request_id is null or length(trim(coalesce(p_title,''))) not between 1 and 200 or p_meeting_date is null or not isfinite(p_meeting_date) then raise exception 'Titlul și data sunt obligatorii.';end if;
 if p_program_kind not in('official','rehearsal') then raise exception 'Tip de program invalid.';end if;
 if p_source_id is not null and (p_song_id is null or not exists(select 1 from public.song_sources where id=p_source_id and song_id=p_song_id)) then raise exception 'Sursa invalidă.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,79));
 select meeting_id into mid from public.meeting_create_requests_v49 where user_id=auth.uid() and request_id=p_request_id;
 if mid is not null then return mid;end if;
 insert into public.meetings(title,meeting_type,meeting_date,notes,created_by,last_modified_by,last_modified_at,status,program_kind)
 values(trim(p_title),nullif(trim(p_meeting_type),''),p_meeting_date,nullif(trim(p_notes),''),auth.uid(),auth.uid(),now(),'draft',p_program_kind) returning id into mid;
 if p_song_id is not null then perform public.add_program_song_v52(mid,p_song_id,p_source_id,coalesce(p_is_backup,false),null,null);end if;
 insert into public.meeting_create_requests_v49(user_id,request_id,meeting_id) values(auth.uid(),p_request_id,mid);
 return mid;
end $$;

create or replace function public.set_meeting_kind_v79(p_meeting uuid,p_kind text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_kind not in('official','rehearsal') then raise exception 'Tip de program invalid.';end if;
 update public.meetings set program_kind=p_kind where id=p_meeting;
 if not found then raise exception 'Programul nu există.';end if;
 return true;
end $$;

create or replace function public.create_title_only_song_v79(p_collection uuid,p_title text,p_number text default null,p_default_key text default null,p_bpm integer default null,p_structure text default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if length(trim(coalesce(p_title,''))) not between 1 and 300 then raise exception 'Titlul cântării este obligatoriu.';end if;
 if not exists(select 1 from public.song_collections where id=p_collection and is_active) then raise exception 'Colecția nu este activă.';end if;
 if p_bpm is not null and p_bpm not between 30 and 260 then raise exception 'BPM trebuie să fie între 30 și 260.';end if;
 if length(coalesce(p_number,''))>60 or length(coalesce(p_default_key,''))>20 or length(coalesce(p_structure,''))>500 or length(coalesce(p_notes,''))>5000 then raise exception 'Un câmp este prea lung.';end if;
 insert into public.songs(title,lyrics_text,default_key,bpm,structure,notes,is_active) values(trim(p_title),null,nullif(trim(p_default_key),''),p_bpm,nullif(trim(p_structure),''),nullif(trim(p_notes),''),true) returning id into sid;
 insert into public.song_sources(song_id,collection_id,song_number,source_title) values(sid,p_collection,nullif(trim(p_number),''),trim(p_title));
 return sid;
end $$;

create or replace function public.duplicate_meeting(p_meeting_id uuid,p_title text,p_meeting_date timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_meeting public.meetings;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if nullif(trim(p_title),'') is null or p_meeting_date is null then raise exception 'Titlul și data sunt obligatorii.';end if;
 select * into v_meeting from public.meetings where id=p_meeting_id for share;
 if not found then raise exception 'Programul nu există.';end if;
 insert into public.meetings(title,meeting_type,meeting_date,notes,created_by,status,principal_responsible,secondary_responsibles,program_kind)
 values(trim(p_title),v_meeting.meeting_type,p_meeting_date,v_meeting.notes,auth.uid(),'draft',v_meeting.principal_responsible,v_meeting.secondary_responsibles,v_meeting.program_kind) returning id into v_id;
 insert into public.meeting_items(meeting_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name,selected_source_id,is_congregational,performance_structure,moment_kind,moment_color)
 select v_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name,selected_source_id,is_congregational,performance_structure,moment_kind,moment_color from public.meeting_items where meeting_id=p_meeting_id;
 return v_id;
end $$;

-- Rehearsals remain fully usable programs, but never become song performances.
create or replace view public.song_performance_occurrences_v46 with(security_invoker=true) as
 select distinct mi.song_id,m.id as meeting_id,m.title as meeting_title,m.meeting_date,m.meeting_type
 from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
 where mi.song_id is not null and not mi.is_backup and not m.is_template and m.program_kind='official' and m.meeting_date<=now()
 and not exists(select 1 from public.song_usage_exclusions_v65 e where e.song_id=mi.song_id and e.meeting_id=m.id);
revoke all on public.song_performance_occurrences_v46 from public,anon;
grant select on public.song_performance_occurrences_v46 to authenticated;

create or replace function public.get_song_history_v46(p_song_id uuid,p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security invoker set search_path=public as $$
with uses as materialized(
 select distinct mi.song_id,m.id meeting_id,m.title meeting_title,m.meeting_date,m.meeting_type,(m.meeting_date>now()) is_future,
 exists(select 1 from public.song_usage_exclusions_v65 e where e.song_id=mi.song_id and e.meeting_id=m.id) is_excluded
 from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
 where mi.song_id=p_song_id and not mi.is_backup and not m.is_template and m.program_kind='official'
),rows as(select * from uses order by meeting_date desc,meeting_id limit least(greatest(coalesce(p_page_size,30),1),100) offset(greatest(coalesce(p_page,1),1)::bigint-1)*least(greatest(coalesce(p_page_size,30),1),100))
select jsonb_build_object('total',(select count(*) from uses),'performed_total',(select count(*) from uses where not is_future and not is_excluded),'upcoming_total',(select count(*) from uses where is_future),'last_used_at',(select max(meeting_date) from uses where not is_future and not is_excluded),'entries',coalesce((select jsonb_agg(to_jsonb(rows) order by meeting_date desc,meeting_id) from rows),'[]'::jsonb));
$$;

create or replace function public.song_program_events_v52(p_song_id uuid,p_exclude_meeting uuid default null)
returns table(meeting_id uuid,meeting_title text,meeting_date timestamptz,is_backup boolean,phase text)
language sql stable security invoker set search_path=public as $$
 select m.id,m.title,m.meeting_date,bool_and(mi.is_backup),case when m.meeting_date>now() then 'planned' when m.meeting_date+interval '2 hours'>now() then 'in_progress' else 'finished' end
 from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
 where mi.song_id=p_song_id and not m.is_template and m.program_kind='official' and(p_exclude_meeting is null or m.id<>p_exclude_meeting)
 and(m.status<>'archived' or m.meeting_date+interval '2 hours'<=now())
 and not exists(select 1 from public.song_usage_exclusions_v65 e where e.song_id=mi.song_id and e.meeting_id=m.id and m.meeting_date<=now()) group by m.id;
$$;

create or replace function public.set_song_usage_exclusion_v65(p_song uuid,p_meetings uuid[],p_excluded boolean,p_reason text default '') returns boolean language plpgsql security definer set search_path=public as $$
declare mid uuid;begin
 if not public.can_edit_content() then raise exception 'Doar persoanele cu drept de editare pot corecta istoricul.' using errcode='42501';end if;
 if p_excluded is null or coalesce(cardinality(p_meetings),0) not between 1 and 100 or length(coalesce(p_reason,''))>500 then raise exception 'Selecție invalidă.';end if;
 foreach mid in array p_meetings loop
  if p_excluded then
   if not exists(select 1 from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id where mi.song_id=p_song and m.id=mid and not mi.is_backup and not m.is_template and m.program_kind='official' and m.meeting_date<=now()) then raise exception 'Cântarea nu este în lista principală a unui program oficial trecut/în curs.';end if;
   insert into public.song_usage_exclusions_v65(song_id,meeting_id,reason,created_by) values(p_song,mid,coalesce(p_reason,''),auth.uid()) on conflict(song_id,meeting_id) do update set reason=excluded.reason,created_by=excluded.created_by,created_at=now();
  else delete from public.song_usage_exclusions_v65 where song_id=p_song and meeting_id=mid;end if;
 end loop;
 insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id,details) values(auth.uid(),case when p_excluded then 'usage.exclude' else 'usage.restore' end,'songs',p_song::text,jsonb_build_object('meeting_ids',p_meetings,'count',cardinality(p_meetings)));
 return true;
end $$;

create or replace function public.get_shared_meeting_v79(p_public_slug text) returns jsonb language sql stable security definer set search_path=public as $$
 select case when b.data is null then null else jsonb_set(b.data,'{meeting}',(b.data->'meeting')||jsonb_build_object('program_kind',m.program_kind),true) end
 from(select public.get_shared_meeting(p_public_slug) data)b
 left join public.meeting_share_links l on l.public_slug=p_public_slug and l.is_active and(l.expires_at is null or l.expires_at>now())
 left join public.meetings m on m.id=l.meeting_id;
$$;

create or replace function public.list_public_programs_v66(p_page integer default 1,p_page_size integer default 4) returns jsonb language sql stable security definer set search_path=public as $$
with eligible as materialized(
 select m.id,m.title,m.meeting_date,m.program_kind,l.public_slug,case when m.meeting_date<=now() and m.meeting_date+interval '2 hours'>now() then 'in_progress' when m.meeting_date>now() then 'planned' else 'finished' end phase
 from public.meetings m join lateral(select public_slug from public.meeting_share_links where meeting_id=m.id and is_active and(expires_at is null or expires_at>now()) order by created_at desc,id limit 1)l on true where not m.is_template and m.status<>'archived'
),latest as(select *,0 slot from eligible where meeting_date<=now() order by meeting_date desc,id limit 1),upcoming as(select *,1 slot from eligible where meeting_date>now() order by meeting_date,id limit 4),chosen as(select * from(select * from latest union all select * from upcoming)x order by slot,meeting_date,id limit 4)
select jsonb_build_object('total',(select count(*) from chosen),'page',1,'pageSize',4,'programs',coalesce((select jsonb_agg(jsonb_build_object('title',title,'date',meeting_date,'slug',public_slug,'phase',phase,'programKind',program_kind) order by slot,meeting_date,id) from chosen),'[]'));
$$;

create or replace function public.audit_write_v48() returns trigger language plpgsql security definer set search_path=public as $$
declare v_old jsonb;v_new jsonb;v_row jsonb;v_fields jsonb;v_before jsonb;v_after jsonb;v_label text;
begin
 v_old:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;v_new:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;v_row:=case when tg_op='DELETE' then v_old else v_new end;
 select coalesce(jsonb_agg(key order by key),'[]') into v_fields from(select key from jsonb_each(v_old||v_new) where(v_old->key)is distinct from(v_new->key))x;
 select coalesce(jsonb_object_agg(key,value),'{}') into v_before from jsonb_each(v_old) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions','color','selected_source_id','is_congregational','program_kind']);
 select coalesce(jsonb_object_agg(key,value),'{}') into v_after from jsonb_each(v_new) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions','color','selected_source_id','is_congregational','program_kind']);
 v_label:=coalesce(v_row->>'title',v_row->>'name',v_row->>'custom_title',public.activity_resource_label_v56(tg_table_name,v_row->>'id'),(select title from public.songs where id=nullif(v_row->>'song_id','')::uuid),(select title from public.meetings where id=nullif(v_row->>'meeting_id','')::uuid));
 insert into public.activity_log_v48(actor_id,actor_email,event_type,resource_type,resource_id,details) values(auth.uid(),(select email from public.profiles where id=auth.uid()),lower(tg_op),tg_table_name,coalesce(v_row->>'id',v_row->>'song_id',v_row->>'source_key'),jsonb_build_object('fields',v_fields,'before',v_before,'after',v_after,'resource_label',v_label));return null;
end $$;

revoke all on function public.create_meeting_v79(uuid,text,text,timestamptz,text,text,uuid,boolean,uuid),public.set_meeting_kind_v79(uuid,text),public.create_title_only_song_v79(uuid,text,text,text,integer,text,text),public.get_shared_meeting_v79(text) from public,anon;
grant execute on function public.create_meeting_v79(uuid,text,text,timestamptz,text,text,uuid,boolean,uuid),public.set_meeting_kind_v79(uuid,text),public.create_title_only_song_v79(uuid,text,text,text,integer,text,text) to authenticated;
grant execute on function public.get_shared_meeting_v79(text),public.list_public_programs_v66(integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;

begin;

-- "Momente" behaves like one visual collection. One color is applied to every
-- existing and future non-song item, instead of storing unrelated item colors.
create table if not exists public.program_moment_style_v80(
 id smallint primary key default 1 check(id=1),
 name text not null default 'Momente',
 color text not null default '#d97706' check(color ~ '^#[0-9A-Fa-f]{6}$'),
 opacity integer not null default 100 check(opacity in(25,50,75,100)),
 updated_at timestamptz not null default now()
);
alter table public.program_moment_style_v80 enable row level security;
drop policy if exists moment_style_read_v80 on public.program_moment_style_v80;
create policy moment_style_read_v80 on public.program_moment_style_v80 for select to authenticated using(public.current_user_role() is not null);
revoke all on public.program_moment_style_v80 from public,anon,authenticated;
grant select on public.program_moment_style_v80 to authenticated;
grant all on public.program_moment_style_v80 to service_role;

insert into public.program_moment_style_v80(id,color,opacity)
select 1,coalesce((select moment_color from public.meeting_items where song_id is null group by moment_color order by count(*) desc,moment_color limit 1),'#d97706'),100
on conflict(id) do nothing;

alter table public.meeting_items add column if not exists moment_opacity integer not null default 100 check(moment_opacity in(25,50,75,100));
update public.meeting_items mi set moment_color=s.color,moment_opacity=s.opacity from public.program_moment_style_v80 s where mi.song_id is null and(mi.moment_color is distinct from s.color or mi.moment_opacity is distinct from s.opacity);

create or replace function public.apply_program_moment_style_v80() returns trigger language plpgsql security definer set search_path=public as $$
declare style public.program_moment_style_v80;
begin
 if new.song_id is null then
  select * into style from public.program_moment_style_v80 where id=1;
  new.moment_color:=coalesce(style.color,'#d97706');new.moment_opacity:=coalesce(style.opacity,100);
 end if;
 return new;
end $$;
revoke all on function public.apply_program_moment_style_v80() from public,anon,authenticated;
drop trigger if exists apply_program_moment_style_v80 on public.meeting_items;
create trigger apply_program_moment_style_v80 before insert or update of song_id,moment_color,moment_opacity on public.meeting_items for each row execute function public.apply_program_moment_style_v80();

-- The anonymous program payload exposes the global moment intensity as well.
create or replace function public.get_shared_meeting_v79(p_public_slug text) returns jsonb language sql stable security definer set search_path=public as $$
 with base as(select public.get_shared_meeting(p_public_slug) data), enriched as(
  select coalesce(jsonb_agg(item||jsonb_build_object('moment_opacity',mi.moment_opacity) order by ord),'[]'::jsonb) items
  from base cross join lateral jsonb_array_elements(coalesce(base.data->'items','[]'::jsonb)) with ordinality as rows(item,ord)
  left join public.meeting_items mi on mi.id=nullif(item->>'id','')::uuid
 )
 select case when base.data is null then null else jsonb_set(jsonb_set(base.data,'{meeting}',(base.data->'meeting')||jsonb_build_object('program_kind',m.program_kind),true),'{items}',enriched.items,true) end
 from base left join public.meeting_share_links l on l.public_slug=p_public_slug and l.is_active and(l.expires_at is null or l.expires_at>now())
 left join public.meetings m on m.id=l.meeting_id cross join enriched;
$$;

create or replace function public.set_program_moment_style_v80(p_color text,p_opacity integer default 100) returns jsonb language plpgsql security definer set search_path=public as $$
declare result public.program_moment_style_v80;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_color is null or p_color !~ '^#[0-9A-Fa-f]{6}$' or p_opacity not in(25,50,75,100) then raise exception 'Culoare sau intensitate invalidă.';end if;
 update public.program_moment_style_v80 set color=lower(p_color),opacity=p_opacity,updated_at=now() where id=1 returning * into result;
 update public.meeting_items set moment_color=result.color,moment_opacity=result.opacity where song_id is null and(moment_color is distinct from result.color or moment_opacity is distinct from result.opacity);
 insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id,details) values(auth.uid(),'moment.style_update','program_moment_style_v80','1',jsonb_build_object('fields',jsonb_build_array('color','opacity'),'after',jsonb_build_object('color',result.color,'opacity',result.opacity),'resource_label','Momente'));
 return to_jsonb(result);
end $$;

create or replace function public.admin_update_profile_v80(p_id uuid,p_name text,p_role text,p_active boolean) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if public.current_user_role()<>'admin' then raise exception 'Doar administratorii pot modifica utilizatori.' using errcode='42501';end if;
 if nullif(btrim(p_name),'') is null or length(btrim(p_name))>120 then raise exception 'Numele afișat este obligatoriu și poate avea maximum 120 de caractere.';end if;
 perform public.admin_set_profile_v48(p_id,p_role,p_active);
 update public.profiles set full_name=btrim(p_name),updated_at=now() where id=p_id;
 if not found then raise exception 'Utilizatorul nu există.';end if;
 return true;
end $$;

-- Collection-number suggestion uses released numbers first, then the next
-- numeric value while preserving the collection's zero padding.
create or replace function public.next_song_numbers_v80() returns table(collection_id uuid,next_number text) language plpgsql stable security definer set search_path=public as $$
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 return query
 with stats as(
  select c.id,
   max(ss.song_number::numeric) filter(where ss.song_number ~ '^[0-9]+$') max_number,
   max(length(ss.song_number)) filter(where ss.song_number ~ '^0[0-9]+$') padded_width
  from public.song_collections c left join public.song_sources ss on ss.collection_id=c.id where c.is_active group by c.id
 )
 select st.id,coalesce(
  (select r.number from public.reusable_song_numbers_v78 r where r.collection_id=st.id and not exists(select 1 from public.song_sources used where used.collection_id=st.id and public.song_number_fold_v57(used.song_number)=public.song_number_fold_v57(r.number)) order by case when r.number ~ '^[0-9]+$' then r.number::numeric end nulls last,r.number limit 1),
  lpad((coalesce(st.max_number,0)+1)::text,greatest(coalesce(st.padded_width,1),length((coalesce(st.max_number,0)+1)::text)),'0')
 ) from stats st;
end $$;

-- Backups include the global moment collection setting.
create or replace function public.backup_tables_v64() returns text[] language sql immutable as $$
 select array['song_collections','program_moment_style_v80','songs','categories','bible_versions','bible_books','bible_verses','bible_references','song_files','song_sources','song_sections','song_categories','song_bible_references','meetings','meeting_items','meeting_share_links','public_meeting_contributions','external_sources','external_song_refs','song_link_imports','youth_key_reference_v46','youth_key_applied_v46'];
$$;

revoke all on function public.set_program_moment_style_v80(text,integer),public.admin_update_profile_v80(uuid,text,text,boolean),public.next_song_numbers_v80(),public.backup_tables_v64() from public,anon;
grant execute on function public.set_program_moment_style_v80(text,integer),public.admin_update_profile_v80(uuid,text,text,boolean),public.next_song_numbers_v80() to authenticated;
notify pgrst,'reload schema';
commit;
