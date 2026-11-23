-- Actualizare v84 peste v83. Adaugă wishlisturile și media publică.
begin;

-- Playlisturile sunt liste de idei independente de programe. Elementele lor
-- nu intră în istoricul de utilizare și nu modifică statisticile cântărilor.
create table if not exists public.rehearsal_playlists_v84(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 120),
 notes text check(notes is null or length(notes)<=5000),
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.rehearsal_playlist_items_v84(
 id uuid primary key default gen_random_uuid(),
 playlist_id uuid not null references public.rehearsal_playlists_v84(id) on delete cascade,
 song_id uuid not null references public.songs(id) on delete cascade,
 position integer not null check(position>0),
 notes text check(notes is null or length(notes)<=2000),
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 unique(playlist_id,song_id),unique(playlist_id,position)
);
alter table public.rehearsal_playlists_v84 enable row level security;
alter table public.rehearsal_playlist_items_v84 enable row level security;
revoke all on public.rehearsal_playlists_v84,public.rehearsal_playlist_items_v84 from public,anon,authenticated;
grant all on public.rehearsal_playlists_v84,public.rehearsal_playlist_items_v84 to service_role;

-- Backupul complet păstrează și listele de idei, în ordinea corectă a FK-urilor.
create or replace function public.backup_tables_v64() returns text[] language sql immutable as $$
 select array['song_collections','program_moment_style_v80','songs','rehearsal_playlists_v84','rehearsal_playlist_items_v84','categories','bible_versions','bible_books','bible_verses','bible_references','song_files','song_sources','song_sections','song_categories','song_bible_references','meetings','meeting_items','meeting_share_links','public_meeting_contributions','external_sources','external_song_refs','song_link_imports','youth_key_reference_v46','youth_key_applied_v46'];
$$;
revoke all on function public.backup_tables_v64() from public,anon,authenticated;

create or replace function public.list_rehearsal_playlists_v84() returns table(id uuid,name text,notes text,item_count bigint,updated_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 return query select p.id,p.name,p.notes,count(i.id),p.updated_at from public.rehearsal_playlists_v84 p left join public.rehearsal_playlist_items_v84 i on i.playlist_id=p.id group by p.id order by p.updated_at desc,p.created_at desc;
end $$;

create or replace function public.get_rehearsal_playlist_v84(p_playlist uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 select jsonb_build_object('id',p.id,'name',p.name,'notes',p.notes,'updated_at',p.updated_at,
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'position',i.position,'notes',i.notes,'song',jsonb_build_object('id',s.id,'title',s.title,'default_key',s.default_key,'youtube_url',s.youtube_url,'lyrics_text',s.lyrics_text,'sources',public.song_sources_v52(s.id))||public.song_details_internal_v62(s.id)) order by i.position,i.id) from public.rehearsal_playlist_items_v84 i join public.songs s on s.id=i.song_id where i.playlist_id=p.id),'[]'::jsonb)) into result
 from public.rehearsal_playlists_v84 p where p.id=p_playlist;
 return result;
end $$;

create or replace function public.create_rehearsal_playlist_v84(p_name text,p_notes text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare pid uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 120 or length(coalesce(p_notes,''))>5000 then raise exception 'Nume sau observații invalide.';end if;
 insert into public.rehearsal_playlists_v84(name,notes,created_by) values(btrim(p_name),nullif(btrim(p_notes),''),auth.uid()) returning id into pid;
 insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id,details) values(auth.uid(),'playlist.create','rehearsal_playlists_v84',pid::text,jsonb_build_object('resource_label',btrim(p_name)));
 return pid;
end $$;

create or replace function public.update_rehearsal_playlist_v84(p_playlist uuid,p_name text,p_notes text default null) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 120 or length(coalesce(p_notes,''))>5000 then raise exception 'Nume sau observații invalide.';end if;
 update public.rehearsal_playlists_v84 set name=btrim(p_name),notes=nullif(btrim(p_notes),''),updated_at=now() where id=p_playlist;
 if not found then raise exception 'Playlistul nu există.';end if;
 return true;
end $$;

create or replace function public.add_rehearsal_playlist_song_v84(p_playlist uuid,p_song uuid,p_notes text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare next_position integer;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if length(coalesce(p_notes,''))>2000 then raise exception 'Observațiile sunt prea lungi.';end if;
 perform 1 from public.rehearsal_playlists_v84 where id=p_playlist for update;if not found then raise exception 'Playlistul nu există.';end if;
 if not exists(select 1 from public.songs where id=p_song and is_active) then raise exception 'Cântarea nu există.';end if;
 select coalesce(max(position),0)+1 into next_position from public.rehearsal_playlist_items_v84 where playlist_id=p_playlist;
 insert into public.rehearsal_playlist_items_v84(playlist_id,song_id,position,notes,created_by) values(p_playlist,p_song,next_position,nullif(btrim(p_notes),''),auth.uid())
 on conflict(playlist_id,song_id) do update set notes=coalesce(nullif(btrim(excluded.notes),''),public.rehearsal_playlist_items_v84.notes);
 update public.rehearsal_playlists_v84 set updated_at=now() where id=p_playlist;
 return public.get_rehearsal_playlist_v84(p_playlist);
end $$;

create or replace function public.update_rehearsal_playlist_item_v84(p_playlist uuid,p_item uuid,p_notes text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if length(coalesce(p_notes,''))>2000 then raise exception 'Observațiile sunt prea lungi.';end if;
 update public.rehearsal_playlist_items_v84 set notes=nullif(btrim(p_notes),'') where id=p_item and playlist_id=p_playlist;
 if not found then raise exception 'Cântarea nu mai este în playlist.';end if;
 update public.rehearsal_playlists_v84 set updated_at=now() where id=p_playlist;
 return public.get_rehearsal_playlist_v84(p_playlist);
end $$;

create or replace function public.remove_rehearsal_playlist_song_v84(p_playlist uuid,p_item uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 delete from public.rehearsal_playlist_items_v84 where id=p_item and playlist_id=p_playlist;
 if not found then raise exception 'Cântarea nu mai este în playlist.';end if;
 with ordered as(select id,row_number() over(order by position,id) pos from public.rehearsal_playlist_items_v84 where playlist_id=p_playlist) update public.rehearsal_playlist_items_v84 i set position=100000+ordered.pos from ordered where i.id=ordered.id;
 update public.rehearsal_playlist_items_v84 set position=position-100000 where playlist_id=p_playlist;
 update public.rehearsal_playlists_v84 set updated_at=now() where id=p_playlist;
 return public.get_rehearsal_playlist_v84(p_playlist);
end $$;

create or replace function public.move_rehearsal_playlist_song_v84(p_playlist uuid,p_item uuid,p_direction text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare current_position integer;other_id uuid;other_position integer;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_direction not in('up','down') then raise exception 'Direcție invalidă.';end if;
 perform 1 from public.rehearsal_playlists_v84 where id=p_playlist for update;
 select position into current_position from public.rehearsal_playlist_items_v84 where id=p_item and playlist_id=p_playlist for update;
 if current_position is null then raise exception 'Cântarea nu mai este în playlist.';end if;
 if p_direction='up' then select id,position into other_id,other_position from public.rehearsal_playlist_items_v84 where playlist_id=p_playlist and position<current_position order by position desc limit 1;
 else select id,position into other_id,other_position from public.rehearsal_playlist_items_v84 where playlist_id=p_playlist and position>current_position order by position limit 1;end if;
 if other_id is not null then update public.rehearsal_playlist_items_v84 set position=1000000000 where id=p_item;update public.rehearsal_playlist_items_v84 set position=current_position where id=other_id;update public.rehearsal_playlist_items_v84 set position=other_position where id=p_item;end if;
 update public.rehearsal_playlists_v84 set updated_at=now() where id=p_playlist;
 return public.get_rehearsal_playlist_v84(p_playlist);
end $$;

create or replace function public.delete_rehearsal_playlist_v84(p_playlist uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 delete from public.rehearsal_playlists_v84 where id=p_playlist;if not found then raise exception 'Playlistul nu există.';end if;return true;
end $$;

-- Permite editarea detaliilor până la finalul ferestrei de două ore.
create or replace function public.update_future_meeting_v84(p_meeting uuid,p_title text,p_meeting_type text,p_meeting_date timestamptz,p_notes text,p_program_kind text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if length(btrim(coalesce(p_title,''))) not between 1 and 200 or p_meeting_date is null or not isfinite(p_meeting_date) or p_program_kind not in('official','rehearsal') or length(coalesce(p_meeting_type,''))>100 or length(coalesce(p_notes,''))>5000 then raise exception 'Datele întâlnirii sunt invalide.';end if;
 update public.meetings set title=btrim(p_title),meeting_type=nullif(btrim(p_meeting_type),''),meeting_date=p_meeting_date,notes=nullif(btrim(p_notes),''),program_kind=p_program_kind where id=p_meeting and meeting_date+interval '2 hours'>now() and status<>'archived';
 if not found then raise exception 'Doar întâlnirile care nu s-au finalizat pot fi editate.';end if;
 return true;
end $$;

-- YouTube este disponibil în snapshotul intern și în payloadul anonim.
create or replace function public.get_meeting_snapshot_v46(p_meeting_id uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('revision',m.program_revision,'principal',m.principal_responsible,'secondary',m.secondary_responsibles,
 'items',coalesce((select jsonb_agg(to_jsonb(mi)||jsonb_build_object('sources',public.song_sources_v52(mi.song_id),'songs',case when s.id is null then null else jsonb_build_object('id',s.id,'title',s.title,'lyrics_text',s.lyrics_text,'default_key',s.default_key,'bpm',s.bpm,'structure',s.structure,'youtube_url',s.youtube_url)||public.song_details_v62(s.id) end) order by mi.position,mi.id)
 from public.meeting_items mi left join public.songs s on s.id=mi.song_id where mi.meeting_id=m.id),'[]'::jsonb)) from public.meetings m where m.id=p_meeting_id;
$$;

create or replace function public.get_shared_meeting_v79(p_public_slug text) returns jsonb language sql stable security definer set search_path=public as $$
 with base as(select public.get_shared_meeting(p_public_slug) data),enriched as(
  select coalesce(jsonb_agg((item||jsonb_build_object('moment_opacity',mi.moment_opacity))||case when item->'song' is null or item->'song'='null'::jsonb then '{}'::jsonb else jsonb_build_object('song',(item->'song')||jsonb_build_object('youtube_url',s.youtube_url)) end order by ord),'[]'::jsonb) items
  from base cross join lateral jsonb_array_elements(coalesce(base.data->'items','[]'::jsonb)) with ordinality as rows(item,ord)
  left join public.meeting_items mi on mi.id=nullif(item->>'id','')::uuid left join public.songs s on s.id=nullif(item->'song'->>'id','')::uuid
 )
 select case when base.data is null then null else jsonb_set(jsonb_set(base.data,'{meeting}',(base.data->'meeting')||jsonb_build_object('program_kind',m.program_kind),true),'{items}',enriched.items,true) end
 from base left join public.meeting_share_links l on l.public_slug=p_public_slug and l.is_active and(l.expires_at is null or l.expires_at>now()) left join public.meetings m on m.id=l.meeting_id cross join enriched;
$$;

revoke all on function public.list_rehearsal_playlists_v84(),public.get_rehearsal_playlist_v84(uuid),public.create_rehearsal_playlist_v84(text,text),public.update_rehearsal_playlist_v84(uuid,text,text),public.add_rehearsal_playlist_song_v84(uuid,uuid,text),public.update_rehearsal_playlist_item_v84(uuid,uuid,text),public.remove_rehearsal_playlist_song_v84(uuid,uuid),public.move_rehearsal_playlist_song_v84(uuid,uuid,text),public.delete_rehearsal_playlist_v84(uuid),public.update_future_meeting_v84(uuid,text,text,timestamptz,text,text),public.get_meeting_snapshot_v46(uuid),public.get_shared_meeting_v79(text) from public,anon;
grant execute on function public.list_rehearsal_playlists_v84(),public.get_rehearsal_playlist_v84(uuid),public.create_rehearsal_playlist_v84(text,text),public.update_rehearsal_playlist_v84(uuid,text,text),public.add_rehearsal_playlist_song_v84(uuid,uuid,text),public.update_rehearsal_playlist_item_v84(uuid,uuid,text),public.remove_rehearsal_playlist_song_v84(uuid,uuid),public.move_rehearsal_playlist_song_v84(uuid,uuid,text),public.delete_rehearsal_playlist_v84(uuid),public.update_future_meeting_v84(uuid,text,text,timestamptz,text,text),public.get_meeting_snapshot_v46(uuid) to authenticated;
grant execute on function public.get_shared_meeting_v79(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
