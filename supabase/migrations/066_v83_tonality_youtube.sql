begin;

alter table public.songs add column if not exists youtube_url text;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='songs_youtube_url_v83' and conrelid='public.songs'::regclass) then
  alter table public.songs add constraint songs_youtube_url_v83 check(
   youtube_url is null or (
    length(youtube_url)<=1000 and
    youtube_url ~* '^https://([a-z0-9-]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/'
   )
  );
 end if;
end $$;

-- All write paths (forms, live API, imports and future clients) store musical
-- keys consistently. This prevents a last mobile keystroke or whitespace-only
-- value from appearing saved in the UI while being different in the database.
create or replace function public.normalize_musical_keys_v83() returns trigger language plpgsql set search_path=public as $$
declare normalized text;
begin
 if tg_table_name='songs' then
  normalized:=nullif(regexp_replace(btrim(coalesce(new.default_key,'')),'[[:space:]]+',' ','g'),'');
  if length(coalesce(normalized,''))>20 then raise exception 'Tonalitatea poate avea maximum 20 de caractere.';end if;
  new.default_key:=normalized;
 else
  normalized:=nullif(regexp_replace(btrim(coalesce(new.selected_key,'')),'[[:space:]]+',' ','g'),'');
  if length(coalesce(normalized,''))>20 then raise exception 'Tonalitatea poate avea maximum 20 de caractere.';end if;
  new.selected_key:=normalized;
 end if;
 return new;
end $$;
revoke all on function public.normalize_musical_keys_v83() from public,anon,authenticated;
drop trigger if exists normalize_song_default_key_v83 on public.songs;
create trigger normalize_song_default_key_v83 before insert or update of default_key on public.songs for each row execute function public.normalize_musical_keys_v83();
drop trigger if exists normalize_program_selected_key_v83 on public.meeting_items;
create trigger normalize_program_selected_key_v83 before insert or update of selected_key on public.meeting_items for each row execute function public.normalize_musical_keys_v83();

-- Normalize values already present without changing their musical meaning.
update public.songs set default_key=nullif(regexp_replace(btrim(default_key),'[[:space:]]+',' ','g'),'') where default_key is not null;
update public.meeting_items set selected_key=nullif(regexp_replace(btrim(selected_key),'[[:space:]]+',' ','g'),'') where selected_key is not null;

-- Keep the confirmed program snapshot as the response and trim at the database
-- boundary as a second line of protection for every device.
create or replace function public.update_program_song_v62(p_meeting_id uuid,p_item_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare sid uuid; pattern text; n integer; musical_key text;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 perform 1 from public.meetings where id=p_meeting_id for update;
 select song_id into sid from public.meeting_items where id=p_item_id and meeting_id=p_meeting_id for update;
 if sid is null then raise exception 'Cântarea nu există în acest program.';end if;
 pattern:=nullif(regexp_replace(upper(trim(coalesce(p_data->>'performance_structure',''))),'[[:space:]]','','g'),'');
 if pattern is not null and (length(pattern)>300 or pattern !~ '^(S[0-9]*|R[0-9]*|B[0-9]*)(,(S[0-9]*|R[0-9]*|B[0-9]*))*$') then raise exception 'Structură invalidă. Exemplu: S1,R,S2,R,B,R.';end if;
 if p_data ? 'verse_count' then
  n:=nullif(p_data->>'verse_count','')::integer;
  if n is not null and (n<0 or n>100) then raise exception 'Numărul de strofe trebuie să fie între 0 și 100.';end if;
  update public.songs set verse_count_override=n where id=sid;
 end if;
 musical_key:=nullif(regexp_replace(btrim(coalesce(p_data->>'selected_key','')),'[[:space:]]+',' ','g'),'');
 if length(coalesce(p_data->>'notes',''))>5000 or length(coalesce(p_data->>'responsible_name',''))>120 or length(coalesce(musical_key,''))>20 then raise exception 'Text prea lung.';end if;
 if nullif(p_data->>'selected_source_id','') is not null and not exists(select 1 from public.song_sources where id=(p_data->>'selected_source_id')::uuid and song_id=sid) then raise exception 'Colecția nu aparține cântării.';end if;
 update public.meeting_items set responsible_name=nullif(p_data->>'responsible_name',''),notes=nullif(p_data->>'notes',''),selected_key=musical_key,selected_source_id=case when p_data ? 'selected_source_id' then nullif(p_data->>'selected_source_id','')::uuid else selected_source_id end,performance_structure=pattern where id=p_item_id;
 return public.get_meeting_snapshot_v46(p_meeting_id);
end $$;
revoke all on function public.update_program_song_v62(uuid,uuid,jsonb) from public,anon;
grant execute on function public.update_program_song_v62(uuid,uuid,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;

