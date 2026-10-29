-- ACTUALIZARE v52 → v53 pe ACELAȘI proiect Supabase. Păstrează datele existente.
-- v53: a congregational marker belongs to one program item, never to the library song.
begin;
alter table public.meeting_items add column if not exists is_congregational boolean not null default false;
create or replace function public.guard_congregational_v53() returns trigger language plpgsql set search_path=public as $$
begin
 if new.song_id is null then new.is_congregational:=false;end if;
 return new;
end $$;
drop trigger if exists guard_congregational_v53 on public.meeting_items;
create trigger guard_congregational_v53 before insert or update of song_id,is_congregational on public.meeting_items for each row execute function public.guard_congregational_v53();
create or replace function public.duplicate_meeting(p_meeting_id uuid,p_title text,p_meeting_date timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_meeting public.meetings;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  if nullif(trim(p_title),'') is null or p_meeting_date is null then raise exception 'Titlul și data sunt obligatorii.'; end if;
  select * into v_meeting from public.meetings where id=p_meeting_id for share;
  if not found then raise exception 'Programul nu există.'; end if;
  insert into public.meetings(title,meeting_type,meeting_date,notes,created_by,status,principal_responsible,secondary_responsibles) values(trim(p_title),v_meeting.meeting_type,p_meeting_date,v_meeting.notes,auth.uid(),'draft',v_meeting.principal_responsible,v_meeting.secondary_responsibles) returning id into v_id;
  insert into public.meeting_items(meeting_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name,selected_source_id,is_congregational)
    select v_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name,selected_source_id,is_congregational from public.meeting_items where meeting_id=p_meeting_id;
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
          'is_congregational',mi.is_congregational,
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
 select coalesce(jsonb_object_agg(key,value),'{}') into v_before from jsonb_each(v_old) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions','color','selected_source_id','is_congregational']);
 select coalesce(jsonb_object_agg(key,value),'{}') into v_after from jsonb_each(v_new) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions','color','selected_source_id','is_congregational']);
 insert into public.activity_log_v48(actor_id,actor_email,event_type,resource_type,resource_id,details)
 values(auth.uid(),(select email from public.profiles where id=auth.uid()),lower(tg_op),tg_table_name,coalesce(v_row->>'id',v_row->>'song_id',v_row->>'source_key'),jsonb_build_object('fields',v_fields,'before',v_before,'after',v_after));
 return null;
end $$;


notify pgrst,'reload schema';
commit;
