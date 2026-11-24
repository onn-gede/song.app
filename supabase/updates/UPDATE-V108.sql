-- Actualizare v108 peste v106/v107. Păstrează tonalitățile introduse manual și completează numai valorile lipsă identificate sigur în colecția de tineri.
begin;

-- Completează o tonalitate lipsă numai când numărul și titlul identifică sigur
-- aceeași cântare din colecția de tineri. O tonalitate introdusă manual nu este
-- modificată niciodată de această funcție.
create or replace function public.apply_missing_youth_key_v108(p_song_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_key text;
  matched_key text;
  key_count integer;
begin
  select nullif(btrim(s.default_key), '')
  into existing_key
  from public.songs s
  where s.id = p_song_id
  for update;

  if not found or existing_key is not null then
    return existing_key;
  end if;

  select min(r.musical_key), count(distinct r.musical_key)
  into matched_key, key_count
  from public.song_sources ss
  join public.song_collections sc on sc.id = ss.collection_id
  join public.songs s on s.id = ss.song_id
  join public.youth_key_reference_v46 r
    on lower(btrim(coalesce(ss.song_number, ''))) = lower(btrim(r.reference_number))
   and (
     public.key_title_normalized_v46(r.title) = public.key_title_normalized_v46(s.title)
     or public.key_title_normalized_v46(r.title) = public.key_title_normalized_v46(ss.source_title)
   )
  where ss.song_id = p_song_id
    and r.musical_key is not null
    and length(public.key_title_normalized_v46(r.title)) > 2
    and sc.is_active
    and (
      upper(coalesce(sc.short_code, '')) = 'TINERI'
      or public.key_title_normalized_v46(sc.name) in (
        'tineri',
        'cantari tineri',
        'cantarile tinerilor',
        'cantari pentru tineri'
      )
    );

  if key_count <> 1 or matched_key is null then
    return null;
  end if;

  update public.songs
  set default_key = matched_key
  where id = p_song_id
    and nullif(btrim(default_key), '') is null;

  if found then
    insert into public.youth_key_applied_v46(song_id, previous_key, applied_key)
    values (p_song_id, null, matched_key)
    on conflict (song_id) do nothing;
  end if;

  return matched_key;
end;
$$;

revoke all on function public.apply_missing_youth_key_v108(uuid) from public, anon, authenticated;

create or replace function public.sync_missing_youth_key_from_source_v108()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_missing_youth_key_v108(new.song_id);
  return new;
end;
$$;

revoke all on function public.sync_missing_youth_key_from_source_v108() from public, anon, authenticated;

drop trigger if exists song_sources_sync_youth_key_v108 on public.song_sources;
create trigger song_sources_sync_youth_key_v108
after insert or update of song_id, collection_id, song_number, source_title
on public.song_sources
for each row execute function public.sync_missing_youth_key_from_source_v108();

create or replace function public.sync_missing_youth_key_from_song_v108()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_missing_youth_key_v108(new.id);
  return new;
end;
$$;

revoke all on function public.sync_missing_youth_key_from_song_v108() from public, anon, authenticated;

drop trigger if exists songs_sync_youth_key_v108 on public.songs;
create trigger songs_sync_youth_key_v108
after update of title on public.songs
for each row
when (old.title is distinct from new.title)
execute function public.sync_missing_youth_key_from_song_v108();

-- Recuperează doar tonalitățile lipsă care nu au mai fost aplicate anterior.
-- Astfel, o tonalitate modificată sau ștearsă intenționat de un utilizator rămâne neatinsă.
with matches as materialized (
  select distinct song_id, musical_key
  from public.get_youth_key_matches_v46()
  where match_status = 'matched'
    and song_id is not null
    and musical_key is not null
), logged as (
  insert into public.youth_key_applied_v46(song_id, previous_key, applied_key)
  select m.song_id, s.default_key, m.musical_key
  from matches m
  join public.songs s on s.id = m.song_id
  where nullif(btrim(s.default_key), '') is null
  on conflict (song_id) do nothing
  returning song_id, applied_key
)
update public.songs s
set default_key = l.applied_key
from logged l
where s.id = l.song_id
  and nullif(btrim(s.default_key), '') is null;

-- Completează și potrivirile noi, strict după număr + titlu.
select public.apply_missing_youth_key_v108(s.id)
from public.songs s
where s.is_active
  and nullif(btrim(s.default_key), '') is null;

notify pgrst, 'reload schema';
commit;
