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
