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
