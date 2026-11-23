begin;

alter table public.rehearsal_playlists_v84
  add column if not exists is_public boolean not null default false,
  add column if not exists public_slug text;

create unique index if not exists rehearsal_playlists_v84_public_slug_uq
  on public.rehearsal_playlists_v84(public_slug) where public_slug is not null;

create table if not exists public.public_wishlist_contributions_v103(
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.rehearsal_playlists_v84(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  contributor_name text check(contributor_name is null or length(contributor_name)<=120),
  notes text check(notes is null or length(notes)<=1000),
  status text not null default 'pending' check(status in('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);
create index if not exists public_wishlist_contributions_v103_queue_idx
  on public.public_wishlist_contributions_v103(playlist_id,status,created_at desc);
alter table public.public_wishlist_contributions_v103 enable row level security;
revoke all on public.public_wishlist_contributions_v103 from public,anon,authenticated;
grant all on public.public_wishlist_contributions_v103 to service_role;

create or replace function public.backup_tables_v64() returns text[] language sql immutable as $$
 select array['song_collections','program_moment_style_v80','songs','rehearsal_playlists_v84','rehearsal_playlist_items_v84','public_wishlist_contributions_v103','categories','bible_versions','bible_books','bible_verses','bible_references','song_files','song_sources','song_sections','song_categories','song_bible_references','meetings','meeting_items','meeting_share_links','public_meeting_contributions','external_sources','external_song_refs','song_link_imports','youth_key_reference_v46','youth_key_applied_v46'];
$$;
revoke all on function public.backup_tables_v64() from public,anon,authenticated;

create or replace function public.list_rehearsal_playlists_v103()
returns table(id uuid,name text,notes text,item_count bigint,updated_at timestamptz,is_public boolean,public_slug text,pending_count bigint)
language plpgsql stable security definer set search_path=public as $$
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 return query
 select p.id,p.name,p.notes,count(distinct i.id),p.updated_at,p.is_public,p.public_slug,
   count(distinct c.id) filter(where c.status='pending')
 from public.rehearsal_playlists_v84 p
 left join public.rehearsal_playlist_items_v84 i on i.playlist_id=p.id
 left join public.public_wishlist_contributions_v103 c on c.playlist_id=p.id
 group by p.id order by p.updated_at desc,p.created_at desc;
end $$;

create or replace function public.get_rehearsal_playlist_v84(p_playlist uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 select jsonb_build_object(
  'id',p.id,'name',p.name,'notes',p.notes,'updated_at',p.updated_at,'is_public',p.is_public,'public_slug',p.public_slug,
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'position',i.position,'notes',i.notes,'song',jsonb_build_object('id',s.id,'title',s.title,'default_key',s.default_key,'youtube_url',s.youtube_url,'lyrics_text',s.lyrics_text,'sources',public.song_sources_v52(s.id))||public.song_details_internal_v62(s.id)) order by i.position,i.id) from public.rehearsal_playlist_items_v84 i join public.songs s on s.id=i.song_id where i.playlist_id=p.id),'[]'::jsonb),
  'pending',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'contributor_name',c.contributor_name,'notes',c.notes,'created_at',c.created_at,'song',jsonb_build_object('id',s.id,'title',s.title,'default_key',s.default_key,'youtube_url',s.youtube_url)) order by c.created_at,c.id) from public.public_wishlist_contributions_v103 c join public.songs s on s.id=c.song_id where c.playlist_id=p.id and c.status='pending'),'[]'::jsonb)
 ) into result from public.rehearsal_playlists_v84 p where p.id=p_playlist;
 return result;
end $$;

create or replace function public.set_rehearsal_playlist_visibility_v103(p_playlist uuid,p_public boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_slug text;v_name text;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 select public_slug,name into v_slug,v_name from public.rehearsal_playlists_v84 where id=p_playlist for update;
 if not found then raise exception 'Wishlistul nu există.';end if;
 if coalesce(p_public,false) and v_slug is null then v_slug='wishlist-'||substr(replace(gen_random_uuid()::text,'-',''),1,16);end if;
 update public.rehearsal_playlists_v84 set is_public=coalesce(p_public,false),public_slug=v_slug,updated_at=now() where id=p_playlist;
 insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id,details)
 values(auth.uid(),'wishlist.visibility','rehearsal_playlists_v84',p_playlist::text,jsonb_build_object('resource_label',v_name,'is_public',coalesce(p_public,false)));
 return public.get_rehearsal_playlist_v84(p_playlist);
end $$;

create or replace function public.get_public_wishlist_v103(p_slug text) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
  'id',p.id,'name',p.name,'notes',p.notes,'public_slug',p.public_slug,'updated_at',p.updated_at,
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'position',i.position,'notes',i.notes,'song',jsonb_build_object('id',s.id,'title',s.title,'default_key',s.default_key,'youtube_url',s.youtube_url)) order by i.position,i.id) from public.rehearsal_playlist_items_v84 i join public.songs s on s.id=i.song_id and s.is_active where i.playlist_id=p.id),'[]'::jsonb)
 )
 from public.rehearsal_playlists_v84 p
 where p.is_public and p.public_slug=p_slug and length(p_slug)<=200;
$$;

create or replace function public.search_public_wishlist_songs_v103(p_slug text,p_query text,p_limit integer default 20)
returns table(song_id uuid,title text,default_key text,bpm integer,matched_source text,lyrics_text text)
language plpgsql stable security definer set search_path=public as $$
begin
 if length(coalesce(p_slug,''))>200 or length(btrim(coalesce(p_query,''))) not between 2 and 200 then return;end if;
 if not exists(select 1 from public.rehearsal_playlists_v84 where public_slug=p_slug and is_public) then return;end if;
 return query select r.song_id,r.title,r.default_key,r.bpm,r.matched_source,s.lyrics_text
 from public.search_songs(btrim(p_query),least(greatest(coalesce(p_limit,20),1),30)) r
 join public.songs s on s.id=r.song_id
 order by r.rank desc,r.title;
end $$;

create or replace function public.add_public_wishlist_contribution_v103(
 p_slug text,p_song uuid,p_contributor_name text default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_playlist uuid;v_id uuid;v_now timestamptz:=clock_timestamp();
begin
 if length(coalesce(p_slug,''))>200 or length(coalesce(p_contributor_name,''))>120 or length(coalesce(p_notes,''))>1000 then raise exception 'Datele propunerii sunt prea lungi.';end if;
 select id into v_playlist from public.rehearsal_playlists_v84 where public_slug=p_slug and is_public for update;
 if v_playlist is null then raise exception 'Wishlistul public nu este disponibil.' using errcode='42501';end if;
 if not exists(select 1 from public.songs where id=p_song and is_active) then raise exception 'Cântarea nu există.';end if;
 if exists(select 1 from public.rehearsal_playlist_items_v84 where playlist_id=v_playlist and song_id=p_song) then raise exception 'Cântarea este deja în wishlist.';end if;
 select id into v_id from public.public_wishlist_contributions_v103 where playlist_id=v_playlist and song_id=p_song and status='pending' order by created_at desc limit 1;
 if v_id is not null then return v_id;end if;
 if (select count(*) from public.public_wishlist_contributions_v103 where playlist_id=v_playlist and created_at>v_now-interval '1 minute')>=20 then raise exception 'Prea multe propuneri. Reîncearcă peste un minut.';end if;
 if (select count(*) from public.public_wishlist_contributions_v103 where playlist_id=v_playlist and created_at>v_now-interval '1 hour')>=200 then raise exception 'Limita orară de propuneri a fost atinsă.';end if;
 if (select count(*) from public.public_wishlist_contributions_v103 where playlist_id=v_playlist and status='pending')>=100 then raise exception 'Sunt prea multe propuneri în așteptare.';end if;
 insert into public.public_wishlist_contributions_v103(playlist_id,song_id,contributor_name,notes)
 values(v_playlist,p_song,nullif(btrim(p_contributor_name),''),nullif(btrim(p_notes),'')) returning id into v_id;
 return v_id;
end $$;

create or replace function public.review_public_wishlist_contribution_v103(p_playlist uuid,p_contribution uuid,p_accept boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_song uuid;v_title text;v_position integer;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 select c.song_id,s.title into v_song,v_title from public.public_wishlist_contributions_v103 c join public.songs s on s.id=c.song_id where c.id=p_contribution and c.playlist_id=p_playlist and c.status='pending' for update of c;
 if v_song is null then raise exception 'Propunerea nu mai este în așteptare.';end if;
 if coalesce(p_accept,false) and not exists(select 1 from public.rehearsal_playlist_items_v84 where playlist_id=p_playlist and song_id=v_song) then
  select coalesce(max(position),0)+1 into v_position from public.rehearsal_playlist_items_v84 where playlist_id=p_playlist;
  insert into public.rehearsal_playlist_items_v84(playlist_id,song_id,position,created_by) values(p_playlist,v_song,v_position,auth.uid());
 end if;
 update public.public_wishlist_contributions_v103 set status=case when coalesce(p_accept,false) then 'accepted' else 'rejected' end,reviewed_at=now(),reviewed_by=auth.uid() where id=p_contribution;
 update public.rehearsal_playlists_v84 set updated_at=now() where id=p_playlist;
 insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id,details)
 values(auth.uid(),case when coalesce(p_accept,false) then 'wishlist.proposal.accept' else 'wishlist.proposal.reject' end,'rehearsal_playlists_v84',p_playlist::text,jsonb_build_object('resource_label',v_title,'contribution_id',p_contribution));
 return public.get_rehearsal_playlist_v84(p_playlist);
end $$;

revoke all on function public.list_rehearsal_playlists_v103(),public.set_rehearsal_playlist_visibility_v103(uuid,boolean),public.get_public_wishlist_v103(text),public.search_public_wishlist_songs_v103(text,text,integer),public.add_public_wishlist_contribution_v103(text,uuid,text,text),public.review_public_wishlist_contribution_v103(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.list_rehearsal_playlists_v103(),public.set_rehearsal_playlist_visibility_v103(uuid,boolean),public.review_public_wishlist_contribution_v103(uuid,uuid,boolean) to authenticated;
grant execute on function public.get_public_wishlist_v103(text),public.search_public_wishlist_songs_v103(text,text,integer),public.add_public_wishlist_contribution_v103(text,uuid,text,text) to anon,authenticated;

notify pgrst,'reload schema';
commit;
