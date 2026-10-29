begin;
alter table public.song_collections add column if not exists color text;
with palette as (select id,row_number() over(order by name,id) n from public.song_collections where color is null)
update public.song_collections c set color=(array['#9f1239','#1d4ed8','#047857','#7e22ce','#b45309','#0e7490','#be123c','#4338ca','#4d7c0f','#a21caf','#334155','#92400e'])[((p.n-1)%12+1)::integer] from palette p where p.id=c.id;
alter table public.song_collections alter column color set not null;
do $$ begin if not exists(select 1 from pg_constraint where conname='collection_color_v52' and conrelid='public.song_collections'::regclass) then alter table public.song_collections add constraint collection_color_v52 check(color~'^#[0-9A-Fa-f]{6}$'); end if; end $$;
create or replace function public.default_collection_color_v52() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.color is null or new.color='' then
  select p.color into new.color from unnest(array['#9f1239','#1d4ed8','#047857','#7e22ce','#b45309','#0e7490','#be123c','#4338ca','#4d7c0f','#a21caf','#334155','#92400e']) with ordinality p(color,n)
  order by (select count(*) from public.song_collections c where c.color=p.color),p.n limit 1;
 end if;return new;
end $$;
drop trigger if exists default_collection_color_v52 on public.song_collections;
create trigger default_collection_color_v52 before insert on public.song_collections for each row execute function public.default_collection_color_v52();
alter table public.meeting_items add column if not exists selected_source_id uuid references public.song_sources(id) on delete set null;
create index if not exists meeting_items_source_v52 on public.meeting_items(selected_source_id) where selected_source_id is not null;
create or replace function public.guard_meeting_source_v52() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.song_id is null then new.selected_source_id:=null;return new;end if;
 if tg_op='UPDATE' and new.song_id is distinct from old.song_id and new.selected_source_id is not distinct from old.selected_source_id then new.selected_source_id:=null;end if;
 if new.selected_source_id is null then select ss.id into new.selected_source_id from public.song_sources ss join public.song_collections c on c.id=ss.collection_id where ss.song_id=new.song_id order by c.is_active desc,c.name,ss.song_number,ss.id limit 1;end if;
 if new.selected_source_id is not null and not exists(select 1 from public.song_sources where id=new.selected_source_id and song_id=new.song_id) then raise exception 'Sursa aleasă nu aparține cântării.';end if;
 return new;
end $$;
drop trigger if exists guard_meeting_source_v52 on public.meeting_items;
create trigger guard_meeting_source_v52 before insert or update of song_id,selected_source_id on public.meeting_items for each row execute function public.guard_meeting_source_v52();

create or replace function public.song_sources_v52(p_song_id uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('source_id',ss.id,'collection_id',c.id,'name',c.name,'short_code',c.short_code,'color',c.color,'number',ss.song_number,'is_active',c.is_active) order by c.is_active desc,c.name,ss.song_number,ss.id),'[]'::jsonb)
 from public.song_sources ss join public.song_collections c on c.id=ss.collection_id where ss.song_id=p_song_id;
$$;
revoke all on function public.song_sources_v52(uuid) from public,anon;
grant execute on function public.song_sources_v52(uuid) to authenticated;
create or replace function public.get_meeting_snapshot_v46(p_meeting_id uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('revision',m.program_revision,'principal',m.principal_responsible,'secondary',m.secondary_responsibles,
 'items',coalesce((select jsonb_agg(to_jsonb(mi)||jsonb_build_object('sources',public.song_sources_v52(mi.song_id),'songs',case when s.id is null then null else jsonb_build_object('id',s.id,'title',s.title,'lyrics_text',s.lyrics_text,'default_key',s.default_key,'bpm',s.bpm,'structure',s.structure) end) order by mi.position,mi.id)
 from public.meeting_items mi left join public.songs s on s.id=mi.song_id where mi.meeting_id=m.id),'[]'::jsonb)) from public.meetings m where m.id=p_meeting_id;
$$;
revoke all on function public.get_meeting_snapshot_v46(uuid) from public,anon;
grant execute on function public.get_meeting_snapshot_v46(uuid) to authenticated;
create or replace function public.touch_collection_programs_v52() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.meetings m set updated_at=now() where exists(select 1 from public.meeting_items mi join public.song_sources ss on ss.song_id=mi.song_id where mi.meeting_id=m.id and ss.collection_id=new.id);
 return null;
end $$;
drop trigger if exists touch_collection_programs_v52 on public.song_collections;
create trigger touch_collection_programs_v52 after update of color,name,short_code on public.song_collections for each row when(old.color is distinct from new.color or old.name is distinct from new.name or old.short_code is distinct from new.short_code) execute function public.touch_collection_programs_v52();

create or replace function public.add_program_song_v52(p_meeting_id uuid,p_song_id uuid,p_source_id uuid default null,p_is_backup boolean default false,p_selected_key text default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_source_id is not null and not exists(select 1 from public.song_sources where id=p_source_id and song_id=p_song_id) then raise exception 'Sursa nu aparține cântării.';end if;
 v_id:=public.add_song_to_meeting(p_meeting_id,p_song_id,p_is_backup,p_selected_key,p_notes);
 if p_source_id is not null then update public.meeting_items set selected_source_id=p_source_id where id=v_id;end if;
 return v_id;
end $$;
revoke all on function public.add_program_song_v52(uuid,uuid,uuid,boolean,text,text) from public,anon;
grant execute on function public.add_program_song_v52(uuid,uuid,uuid,boolean,text,text) to authenticated;

-- Distinct meetings: the same song twice in one program is one calendar occurrence.
create or replace function public.song_program_events_v52(p_song_id uuid,p_exclude_meeting uuid default null)
returns table(meeting_id uuid,meeting_title text,meeting_date timestamptz,is_backup boolean,phase text)
language sql stable security invoker set search_path=public as $$
 select m.id,m.title,m.meeting_date,bool_and(mi.is_backup),case when m.meeting_date>now() then 'planned' when m.meeting_date+interval '2 hours'>now() then 'in_progress' else 'finished' end
 from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
 where mi.song_id=p_song_id and not m.is_template and (p_exclude_meeting is null or m.id<>p_exclude_meeting)
 and (m.status<>'archived' or m.meeting_date+interval '2 hours'<=now())
 group by m.id;
$$;
revoke all on function public.song_program_events_v52(uuid,uuid) from public,anon;
grant execute on function public.song_program_events_v52(uuid,uuid) to authenticated;
create or replace function public.search_program_songs_v52(p_query text,p_limit integer default 8,p_exclude_meeting uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('sources',public.song_sources_v52(r.song_id),'schedule',jsonb_build_object(
  'next',(select to_jsonb(e) from public.song_program_events_v52(r.song_id,p_exclude_meeting)e where e.phase<>'finished' order by e.meeting_date,e.meeting_id limit 1),
  'last',(select to_jsonb(e) from public.song_program_events_v52(r.song_id,p_exclude_meeting)e where e.phase='finished' and not e.is_backup order by e.meeting_date desc,e.meeting_id limit 1))) order by r.rank desc,r.title,r.song_id),'[]'::jsonb) into result
 from public.search_program_songs_v49(p_query,least(greatest(p_limit,1),30))r;
 return result;
end $$;
revoke all on function public.search_program_songs_v52(text,integer,uuid) from public,anon;
grant execute on function public.search_program_songs_v52(text,integer,uuid) to authenticated;
create or replace function public.song_schedule_v52(p_song_id uuid,p_month date,p_exclude_meeting uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare first_day date;result jsonb;
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 if p_month is null or extract(year from p_month) not between 1900 and 2200 then raise exception 'Lună invalidă.';end if;
 perform public.record_activity_v48('request.view','/api/songs/'||p_song_id::text||'/schedule',jsonb_build_object('format','calendar'));
 first_day:=date_trunc('month',p_month)::date;
 with events as materialized(select e.*,(e.meeting_date at time zone 'Europe/Bucharest')::date as day from public.song_program_events_v52(p_song_id,p_exclude_meeting)e)
 select jsonb_build_object('month',to_char(first_day,'YYYY-MM'),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.meeting_date,e.meeting_id) from events e where e.day>=first_day and e.day<(first_day+interval '1 month')::date),'[]'::jsonb),
 'past_count',(select count(*) from events where phase='finished' and not is_backup),
 'planned_count',(select count(*) from events where phase<>'finished'),
 'previous_month',(select to_char(max(day),'YYYY-MM') from events where day<first_day),
 'next_month',(select to_char(min(day),'YYYY-MM') from events where day>=(first_day+interval '1 month')::date)) into result;
 return result;
end $$;
revoke all on function public.song_schedule_v52(uuid,date,uuid) from public,anon;
grant execute on function public.song_schedule_v52(uuid,date,uuid) to authenticated;

create or replace function public.duplicate_meeting(p_meeting_id uuid,p_title text,p_meeting_date timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_meeting public.meetings;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  if nullif(trim(p_title),'') is null or p_meeting_date is null then raise exception 'Titlul și data sunt obligatorii.'; end if;
  select * into v_meeting from public.meetings where id=p_meeting_id for share;
  if not found then raise exception 'Programul nu există.'; end if;
  insert into public.meetings(title,meeting_type,meeting_date,notes,created_by,status,principal_responsible,secondary_responsibles) values(trim(p_title),v_meeting.meeting_type,p_meeting_date,v_meeting.notes,auth.uid(),'draft',v_meeting.principal_responsible,v_meeting.secondary_responsibles) returning id into v_id;
  insert into public.meeting_items(meeting_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name,selected_source_id)
    select v_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name,selected_source_id from public.meeting_items where meeting_id=p_meeting_id;
  return v_id;
end $$;

create or replace function public.get_shared_meeting(p_public_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'meeting', jsonb_build_object(
      'title', m.title,
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
          'position', mi.position,
          'item_type', mi.item_type,
          'is_backup', mi.is_backup,
          'custom_title', mi.custom_title,
          'custom_text', mi.custom_text,
          'selected_key', mi.selected_key,
          'selected_source_id',mi.selected_source_id,'sources',public.song_sources_v52(mi.song_id),
          'selected_bpm', mi.selected_bpm,
          'notes', mi.notes,
          'responsible_name', mi.responsible_name,
          'song', case when s.id is null then null else jsonb_build_object(
            'title', s.title,
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


create or replace function public.audit_write_v48() returns trigger language plpgsql security definer set search_path=public as $$
declare v_old jsonb;v_new jsonb;v_row jsonb;v_fields jsonb;v_before jsonb;v_after jsonb;
begin
 v_old:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 v_new:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 v_row:=case when tg_op='DELETE' then v_old else v_new end;
 select coalesce(jsonb_agg(key order by key),'[]') into v_fields from (select key from jsonb_each(v_old||v_new) where (v_old->key) is distinct from (v_new->key)) x;
 -- Never copy credentials, full lyrics, notes, tokens or share slugs into audit data.
 select coalesce(jsonb_object_agg(key,value),'{}') into v_before from jsonb_each(v_old) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions','color','selected_source_id']);
 select coalesce(jsonb_object_agg(key,value),'{}') into v_after from jsonb_each(v_new) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions','color','selected_source_id']);
 insert into public.activity_log_v48(actor_id,actor_email,event_type,resource_type,resource_id,details)
 values(auth.uid(),(select email from public.profiles where id=auth.uid()),lower(tg_op),tg_table_name,coalesce(v_row->>'id',v_row->>'song_id',v_row->>'source_key'),jsonb_build_object('fields',v_fields,'before',v_before,'after',v_after));
 return null;
end $$;

notify pgrst,'reload schema';
commit;
