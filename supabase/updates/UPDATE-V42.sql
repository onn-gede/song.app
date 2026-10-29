-- ACTUALIZARE pentru o bază SongApp cu migrările până la 034 aplicate.
-- Creează mai întâi un backup. Nu rulează resetări și nu importă cântări.
begin;
do $$ begin
  if to_regclass('public.public_meeting_contributions') is null or to_regprocedure('public.upsert_external_song_title_lyrics(uuid,uuid,text,text,text,text,jsonb,text,boolean)') is null then
    raise exception 'Baza existentă nu are toate migrările anterioare. Oprește actualizarea și verifică instalarea.';
  end if;
end $$;

-- FILE: 035_v41_1_full_bible_library_fixed.sql
-- v41.1 - Full Bible local library, fixed for Supabase/PostgreSQL
-- Fixes: generation expression is not immutable
-- Cause: generated columns cannot use non-immutable functions such as unaccent/to_tsvector.
-- Solution: normal search_vector column populated by trigger.

create extension if not exists pgcrypto;
create extension if not exists unaccent;
create extension if not exists pg_trgm;

create table if not exists public.bible_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  language text not null default 'ro',
  source_name text,
  source_url text,
  license_label text,
  license_url text,
  is_public_domain boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bible_books (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.bible_versions(id) on delete cascade,
  book_order integer not null,
  testament text not null check (testament in ('old','new')),
  name text not null,
  normalized_name text,
  short_name text,
  aliases text[] not null default '{}',
  chapters_count integer,
  created_at timestamptz not null default now(),
  unique(version_id, book_order),
  unique(version_id, name)
);

create table if not exists public.bible_verses (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.bible_versions(id) on delete cascade,
  book_id uuid not null references public.bible_books(id) on delete cascade,
  book_order integer not null,
  chapter integer not null check (chapter > 0),
  verse integer not null check (verse > 0),
  text text not null,
  normalized_text text,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  unique(version_id, book_id, chapter, verse)
);

create index if not exists bible_books_version_order_idx on public.bible_books(version_id, book_order);
create index if not exists bible_books_normalized_name_idx on public.bible_books(version_id, normalized_name);
create index if not exists bible_verses_version_book_chapter_verse_idx on public.bible_verses(version_id, book_order, chapter, verse);
create index if not exists bible_verses_search_vector_idx on public.bible_verses using gin(search_vector);
create index if not exists bible_verses_normalized_text_trgm_idx on public.bible_verses using gin(normalized_text gin_trgm_ops);

create or replace function public.normalize_ro_text(p_text text)
returns text
language sql
stable
as $$
  select lower(regexp_replace(public.unaccent(coalesce(p_text, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.set_bible_book_normalized_fields()
returns trigger
language plpgsql
as $$
begin
  new.normalized_name := public.normalize_ro_text(new.name);
  if new.short_name is null or btrim(new.short_name) = '' then
    new.short_name := new.name;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_bible_book_normalized_fields on public.bible_books;
create trigger trg_set_bible_book_normalized_fields
before insert or update of name, short_name
on public.bible_books
for each row
execute function public.set_bible_book_normalized_fields();

create or replace function public.set_bible_verse_search_fields()
returns trigger
language plpgsql
as $$
declare
  v_book_name text;
begin
  select b.name into v_book_name
  from public.bible_books b
  where b.id = new.book_id;

  new.normalized_text := public.normalize_ro_text(new.text);
  new.search_vector :=
    setweight(to_tsvector('simple', public.normalize_ro_text(coalesce(v_book_name, ''))), 'A') ||
    setweight(to_tsvector('simple', public.normalize_ro_text(coalesce(new.text, ''))), 'B');

  return new;
end;
$$;

drop trigger if exists trg_set_bible_verse_search_fields on public.bible_verses;
create trigger trg_set_bible_verse_search_fields
before insert or update of text, book_id
on public.bible_verses
for each row
execute function public.set_bible_verse_search_fields();

-- Seed the RCCV version record. The actual verses are imported by scripts/import-romanian-bible-rccv.mjs.
insert into public.bible_versions (
  code,
  name,
  language,
  source_name,
  source_url,
  license_label,
  license_url,
  is_public_domain,
  is_active
)
values (
  'rccv',
  'Romanian Corrected Cornilescu Version',
  'ro',
  'seven1m/open-bibles',
  'https://github.com/seven1m/open-bibles',
  'Public Domain / freely available source dataset',
  'https://github.com/seven1m/open-bibles',
  true,
  true
)
on conflict (code) do update set
  name = excluded.name,
  language = excluded.language,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  license_label = excluded.license_label,
  license_url = excluded.license_url,
  is_public_domain = excluded.is_public_domain,
  is_active = excluded.is_active,
  updated_at = now();

-- Recompute fields for existing rows, if any.
update public.bible_books set name = name;
update public.bible_verses set text = text;

create or replace function public.bible_library_stats()
returns table (
  version_code text,
  version_name text,
  books_count bigint,
  old_testament_books bigint,
  new_testament_books bigint,
  verses_count bigint,
  chapters_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    v.code as version_code,
    v.name as version_name,
    count(distinct b.id) as books_count,
    count(distinct b.id) filter (where b.testament = 'old') as old_testament_books,
    count(distinct b.id) filter (where b.testament = 'new') as new_testament_books,
    count(distinct vs.id) as verses_count,
    count(distinct (b.id::text || ':' || vs.chapter::text)) as chapters_count
  from public.bible_versions v
  left join public.bible_books b on b.version_id = v.id
  left join public.bible_verses vs on vs.book_id = b.id
  group by v.code, v.name
  order by v.code;
$$;

create or replace function public.find_bible_book_id(
  p_version_code text,
  p_book_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_normalized text := public.normalize_ro_text(p_book_name);
begin
  select b.id into v_book_id
  from public.bible_books b
  join public.bible_versions v on v.id = b.version_id
  where v.code = lower(p_version_code)
    and (
      b.normalized_name = v_normalized
      or public.normalize_ro_text(b.short_name) = v_normalized
      or exists (
        select 1 from unnest(b.aliases) a
        where public.normalize_ro_text(a) = v_normalized
      )
    )
  order by b.book_order
  limit 1;

  return v_book_id;
end;
$$;

create or replace function public.get_bible_reference_text(
  p_book_name text,
  p_chapter integer,
  p_verse_start integer,
  p_verse_end integer default null,
  p_version_code text default 'rccv'
)
returns table (
  reference_label text,
  version_code text,
  book_name text,
  chapter integer,
  verse_start integer,
  verse_end integer,
  text text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_book_name text;
  v_end integer := coalesce(p_verse_end, p_verse_start);
begin
  v_book_id := public.find_bible_book_id(p_version_code, p_book_name);

  if v_book_id is null then
    return;
  end if;

  select b.name into v_book_name
  from public.bible_books b
  where b.id = v_book_id;

  return query
  select
    case
      when p_verse_start = v_end then format('%s %s:%s', v_book_name, p_chapter, p_verse_start)
      else format('%s %s:%s-%s', v_book_name, p_chapter, p_verse_start, v_end)
    end as reference_label,
    lower(p_version_code) as version_code,
    v_book_name as book_name,
    p_chapter as chapter,
    p_verse_start as verse_start,
    v_end as verse_end,
    string_agg(format('%s. %s', vs.verse, vs.text), E'\n' order by vs.verse) as text
  from public.bible_verses vs
  where vs.book_id = v_book_id
    and vs.chapter = p_chapter
    and vs.verse between p_verse_start and v_end;
end;
$$;

create or replace function public.search_bible_verses(
  p_query text,
  p_limit integer default 20,
  p_version_code text default 'rccv'
)
returns table (
  verse_id uuid,
  reference_label text,
  version_code text,
  book_name text,
  chapter integer,
  verse integer,
  text text,
  rank real
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := public.normalize_ro_text(p_query);
  v_tsquery tsquery;
begin
  if v_query is null or length(trim(v_query)) = 0 then
    return;
  end if;

  v_tsquery := websearch_to_tsquery('simple', v_query);

  return query
  select
    vs.id as verse_id,
    format('%s %s:%s', b.name, vs.chapter, vs.verse) as reference_label,
    v.code as version_code,
    b.name as book_name,
    vs.chapter,
    vs.verse,
    vs.text,
    greatest(
      ts_rank_cd(vs.search_vector, v_tsquery),
      similarity(vs.normalized_text, v_query) * 0.35
    )::real as rank
  from public.bible_verses vs
  join public.bible_books b on b.id = vs.book_id
  join public.bible_versions v on v.id = vs.version_id
  where v.code = lower(p_version_code)
    and (
      vs.search_vector @@ v_tsquery
      or vs.normalized_text % v_query
    )
  order by rank desc, b.book_order, vs.chapter, vs.verse
  limit greatest(1, least(coalesce(p_limit, 20), 100));
end;
$$;

-- RLS: authenticated users may read; writes should use service role import script.
alter table public.bible_versions enable row level security;
alter table public.bible_books enable row level security;
alter table public.bible_verses enable row level security;

drop policy if exists "bible_versions_read_authenticated" on public.bible_versions;
create policy "bible_versions_read_authenticated"
on public.bible_versions
for select
to authenticated
using (true);

drop policy if exists "bible_books_read_authenticated" on public.bible_books;
create policy "bible_books_read_authenticated"
on public.bible_books
for select
to authenticated
using (true);

drop policy if exists "bible_verses_read_authenticated" on public.bible_verses;
create policy "bible_verses_read_authenticated"
on public.bible_verses
for select
to authenticated
using (true);

-- Also allow anonymous read for public shared program pages if needed.
drop policy if exists "bible_versions_read_anon" on public.bible_versions;
create policy "bible_versions_read_anon"
on public.bible_versions
for select
to anon
using (true);

drop policy if exists "bible_books_read_anon" on public.bible_books;
create policy "bible_books_read_anon"
on public.bible_books
for select
to anon
using (true);

drop policy if exists "bible_verses_read_anon" on public.bible_verses;
create policy "bible_verses_read_anon"
on public.bible_verses
for select
to anon
using (true);

notify pgrst, 'reload schema';


-- FILE: 036_v42_stabilization.sql
-- v42: run ONCE after 035_v41_1_full_bible_library_fixed.sql.
-- No data reset; transactional. Scope is limited to SongApp tables/functions.

-- A restrictive policy complements existing read/write policies, including FOR ALL.
do $$
declare t text;
begin
  foreach t in array array['profiles','song_collections','songs','song_files','song_sources','song_sections','categories','song_categories','meetings','meeting_items','meeting_share_links','bible_references','song_bible_references','external_sources','external_song_refs','external_sync_runs','public_meeting_contributions','bible_versions','bible_books','bible_verses'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists songapp_active_profile on public.%I', t);
      execute format('create policy songapp_active_profile on public.%I as restrictive for all to authenticated using (public.current_user_role() is not null) with check (public.current_user_role() is not null)', t);
      execute format('grant select,insert,update,delete on public.%I to authenticated,service_role', t);
    end if;
  end loop;
end $$;

-- Scope the Storage guard to SongApp's private bucket only.
do $$ begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists songapp_active_storage on storage.objects;
    create policy songapp_active_storage on storage.objects as restrictive for all to authenticated
      using (bucket_id is distinct from 'song-files' or public.current_user_role() is not null)
      with check (bucket_id is distinct from 'song-files' or public.current_user_role() is not null);
  end if;
end $$;

-- Reads respect RLS for direct calls. Calls inside a validated public-share RPC
-- retain the definer context of that outer function.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('search_songs','get_song_recent_usage','get_song_recent_usage_excluding_meeting','find_duplicate_song_candidates','import_sync_integrity_report','bible_library_stats','find_bible_book_id','get_bible_reference_text','search_bible_verses','cleanup_repeated_song_titles_in_sections')
  loop execute format('alter function %s security invoker', f.signature); end loop;
end $$;

create or replace function public.list_song_library(
  p_collection uuid default null, p_category uuid default null, p_number text default null,
  p_status text default null, p_key text default null, p_sort text default 'title_asc',
  p_page integer default 1, p_page_size integer default 50
) returns jsonb language sql stable security invoker set search_path = public as $$
with filtered as materialized (
  select s.id,s.title,s.default_key,s.bpm,s.structure,s.created_at,
    (select min(nullif(regexp_replace(src.song_number,'[^0-9]','','g'),'')::numeric)
       from public.song_sources src where src.song_id=s.id
       and (p_collection is null or src.collection_id=p_collection)) as source_number
  from public.songs s
  where s.is_active
    and (p_key is null or s.default_key=p_key)
    and (p_collection is null or exists(select 1 from public.song_sources src where src.song_id=s.id and src.collection_id=p_collection))
    and (p_category is null or exists(select 1 from public.song_categories c where c.song_id=s.id and c.category_id=p_category))
    and (nullif(trim(p_number),'') is null or exists(select 1 from public.song_sources src where src.song_id=s.id and (src.song_number ilike '%'||p_number||'%' or src.source_title ilike '%'||p_number||'%')))
    and (p_status is null or exists(select 1 from public.song_files f where f.song_id=s.id and f.import_status::text=p_status))
), paged as (
  select * from filtered
  order by
    case when p_sort='created_desc' then created_at end desc,
    case when p_sort='source_number_asc' then source_number end asc nulls last,
    case when p_sort='source_number_desc' then source_number end desc nulls last,
    case when p_sort='title_desc' then title end desc,
    case when p_sort<>'title_desc' then title end asc,
    id
  limit least(greatest(coalesce(p_page_size,50),1),100)
  offset (greatest(coalesce(p_page,1),1)::bigint-1)*least(greatest(coalesce(p_page_size,50),1),100)
)
select jsonb_build_object(
  'total',(select count(*) from filtered),
  'keys',(select coalesce(jsonb_agg(k.default_key order by k.default_key),'[]'::jsonb) from (select distinct default_key from public.songs where is_active and default_key is not null) k),
  'songs',coalesce((select jsonb_agg(to_jsonb(p)-'source_number' || jsonb_build_object(
    'song_sources',(select coalesce(jsonb_agg(jsonb_build_object('song_number',ss.song_number,'source_title',ss.source_title,'song_collections',jsonb_build_object('id',sc.id,'name',sc.name,'short_code',sc.short_code)) order by sc.name,ss.song_number,ss.id),'[]'::jsonb) from public.song_sources ss left join public.song_collections sc on sc.id=ss.collection_id where ss.song_id=p.id),
    'song_categories',(select coalesce(jsonb_agg(jsonb_build_object('categories',jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug)) order by c.name),'[]'::jsonb) from public.song_categories x join public.categories c on c.id=x.category_id where x.song_id=p.id),
    'song_files',(select coalesce(jsonb_agg(jsonb_build_object('import_status',sf.import_status) order by sf.created_at,sf.id),'[]'::jsonb) from public.song_files sf where sf.song_id=p.id)
  )) from paged p),'[]'::jsonb)
);
$$;

-- Planning metadata is optional for all existing rows.
alter table public.meetings add column if not exists is_template boolean not null default false;
alter table public.meeting_items add column if not exists responsible_name text;

-- Templates must not count as actual song usage.
create or replace function public.get_song_recent_usage(days_back integer default 30)
returns table (
  song_id uuid,
  title text,
  last_used_at timestamptz,
  times_used bigint,
  last_meeting_title text
)
language sql
stable
security invoker
set search_path = public
as $$
  with usage_rows as (
    select
      s.id as song_id,
      s.title,
      m.meeting_date,
      m.title as meeting_title,
      row_number() over (partition by s.id order by m.meeting_date desc) as rn
    from public.songs s
    join public.meeting_items mi on mi.song_id = s.id
    join public.meetings m on m.id = mi.meeting_id
    where mi.is_backup = false
      and not m.is_template
      and m.meeting_date >= now() - make_interval(days => days_back)
  )
  select
    song_id,
    title,
    max(meeting_date) as last_used_at,
    count(*) as times_used,
    max(meeting_title) filter (where rn = 1) as last_meeting_title
  from usage_rows
  group by song_id, title
  order by last_used_at desc;
$$;

create or replace function public.get_song_recent_usage_excluding_meeting(
  days_back integer default 30,
  excluded_meeting_id uuid default null
)
returns table (
  song_id uuid,
  title text,
  last_used_at timestamptz,
  times_used bigint,
  last_meeting_title text
)
language sql
stable
security invoker
set search_path = public
as $$
  with usage_rows as (
    select
      s.id as song_id,
      s.title,
      m.meeting_date,
      m.title as meeting_title,
      row_number() over (partition by s.id order by m.meeting_date desc) as rn
    from public.songs s
    join public.meeting_items mi on mi.song_id = s.id
    join public.meetings m on m.id = mi.meeting_id
    where mi.is_backup = false
      and not m.is_template
      and m.meeting_date >= now() - make_interval(days => days_back)
      and (excluded_meeting_id is null or m.id <> excluded_meeting_id)
  )
  select
    song_id,
    title,
    max(meeting_date) as last_used_at,
    count(*) as times_used,
    max(meeting_title) filter (where rn = 1) as last_meeting_title
  from usage_rows
  group by song_id, title
  order by last_used_at desc;
$$;

-- Persistent queue. The web application only enqueues/cancels; a separate worker
-- claims one bounded unit at a time. Token + row lock fence cancelled/stale workers.
alter table public.external_sync_runs
  add column if not exists options jsonb,
  add column if not exists discovered_links jsonb not null default '[]'::jsonb,
  add column if not exists next_index integer not null default 0,
  add column if not exists error_count integer not null default 0,
  add column if not exists lease_token uuid,
  add column if not exists lease_until timestamptz,
  add column if not exists heartbeat_at timestamptz;

-- Legacy jobs cannot be resumed: they did not save their options or cursor.
update public.external_sync_runs set status='failed',finished_at=now(),error_message='Rulare veche fără progres reluabil. Pornește o nouă sincronizare.'
where status='running' and options is null;
create unique index if not exists external_sync_one_active_source on public.external_sync_runs(external_source_id) where status in ('queued','running');
revoke insert,update,delete on public.external_sync_runs from authenticated;
grant select,insert,update,delete on public.external_sync_runs, public.external_sources, public.external_song_refs to service_role;

create or replace function public.enqueue_external_sync(p_pages integer,p_max_songs integer,p_overwrite boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_source uuid; v_run uuid;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  if p_pages is null or p_pages not between 1 and 10 or p_max_songs is null or p_max_songs not between 1 and 200 then raise exception 'Limite de sincronizare invalide.'; end if;
  select id into v_source from public.external_sources where slug='resursecrestine' and is_enabled;
  if v_source is null then raise exception 'Sursa nu este configurată sau este dezactivată.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_source::text,42));
  select id into v_run from public.external_sync_runs where external_source_id=v_source and status in ('queued','running');
  if v_run is not null then return v_run; end if;
  insert into public.external_sync_runs(external_source_id,status,options)
    values(v_source,'queued',jsonb_build_object('pages',p_pages,'maxSongs',p_max_songs,'overwrite',coalesce(p_overwrite,false))) returning id into v_run;
  return v_run;
end $$;

create or replace function public.cancel_external_sync(p_run_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  update public.external_sync_runs set status='cancelled',finished_at=now(),lease_token=null,lease_until=null,error_message='Anulată manual.' where id=p_run_id and status in ('queued','running');
end $$;

create or replace function public.claim_external_sync()
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.external_sync_runs; s public.external_sources;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Worker only.' using errcode='42501'; end if;
  select * into r from public.external_sync_runs where status in ('queued','running') and options is not null and (lease_until is null or lease_until<now()) order by started_at,id for update skip locked limit 1;
  if r.id is null then return null; end if;
  select * into s from public.external_sources where id=r.external_source_id;
  if s.id is null or not s.is_enabled or s.slug<>'resursecrestine' or s.collection_id is null then
    update public.external_sync_runs set status='failed',finished_at=now(),error_message='Sursa este dezactivată sau nu are colecție.' where id=r.id;
    return null;
  end if;
  update public.external_sync_runs set status='running',lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',heartbeat_at=now() where id=r.id returning * into r;
  return to_jsonb(r)||jsonb_build_object('collection_id',s.collection_id);
end $$;

create or replace function public.checkpoint_external_scan(p_run_id uuid,p_token uuid,p_page integer,p_links jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.external_sync_runs; v_links jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Worker only.' using errcode='42501'; end if;
  select * into r from public.external_sync_runs where id=p_run_id for update;
  if r.id is null or r.status<>'running' or r.lease_token is distinct from p_token or r.lease_until<now() then return false; end if;
  if p_page<>r.pages_scanned+1 or p_page>(r.options->>'pages')::integer then raise exception 'Scan cursor invalid.'; end if;
  select coalesce(jsonb_agg(x.link order by x.first_seen),'[]') into v_links from (
    select distinct on (e.link->>'url') e.link,e.ord as first_seen from jsonb_array_elements(r.discovered_links||coalesce(p_links,'[]')) with ordinality e(link,ord)
    order by e.link->>'url',e.ord
  ) x;
  update public.external_sync_runs set discovered_links=v_links,pages_scanned=p_page,
    found_count=least(jsonb_array_length(v_links),(options->>'maxSongs')::integer),
    lease_token=null,lease_until=null,heartbeat_at=now() where id=r.id;
  return true;
end $$;

create or replace function public.commit_external_sync_song(p_run_id uuid,p_token uuid,p_song jsonb default null,p_error text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.external_sync_runs; v_result text; v_link jsonb; v_collection uuid; v_done boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Worker only.' using errcode='42501'; end if;
  select * into r from public.external_sync_runs where id=p_run_id for update;
  if r.id is null or r.status<>'running' or r.lease_token is distinct from p_token or r.lease_until<now() then return false; end if;
  if r.pages_scanned<(r.options->>'pages')::integer then raise exception 'Scan incomplete.'; end if;
  if r.next_index<r.found_count then
    v_link := r.discovered_links->r.next_index;
    if p_song is not null then
      select collection_id into v_collection from public.external_sources where id=r.external_source_id;
      v_result:= public.upsert_external_song_title_lyrics(r.external_source_id,v_collection,v_link->>'externalId',v_link->>'url',p_song->>'title',p_song->>'lyrics',p_song->'sections',p_song->>'hash',(r.options->>'overwrite')::boolean);
    elsif p_error is not null then v_result:='error'; else v_result:='skipped'; end if;
    r.next_index:=r.next_index+1;
  end if;
  v_done:=r.next_index>=r.found_count;
  update public.external_sync_runs set next_index=r.next_index,
    imported_count=imported_count+case when v_result='imported' then 1 else 0 end,
    updated_count=updated_count+case when v_result='updated' then 1 else 0 end,
    skipped_count=skipped_count+case when v_result='skipped' then 1 else 0 end,
    error_count=error_count+case when v_result='error' then 1 else 0 end,
    error_message=case when p_error is not null then left(p_error,1000) else error_message end,
    status=case when v_done then 'finished' else 'running' end,
    finished_at=case when v_done then now() else null end,
    lease_token=null,lease_until=null,heartbeat_at=now() where id=r.id;
  if v_done then update public.external_sources set last_synced_at=now() where id=r.external_source_id; end if;
  return true;
end $$;

create or replace function public.fail_external_sync(p_run_id uuid,p_token uuid,p_error text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Worker only.' using errcode='42501'; end if;
  update public.external_sync_runs set status='failed',finished_at=now(),lease_token=null,lease_until=null,error_message=left(p_error,1000)
  where id=p_run_id and status='running' and lease_token=p_token and lease_until>=now();
end $$;

create or replace function public.duplicate_meeting(p_meeting_id uuid,p_title text,p_meeting_date timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_meeting public.meetings;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  if nullif(trim(p_title),'') is null or p_meeting_date is null then raise exception 'Titlul și data sunt obligatorii.'; end if;
  select * into v_meeting from public.meetings where id=p_meeting_id for share;
  if not found then raise exception 'Programul nu există.'; end if;
  insert into public.meetings(title,meeting_type,meeting_date,notes,created_by,status) values(trim(p_title),v_meeting.meeting_type,p_meeting_date,v_meeting.notes,auth.uid(),'draft') returning id into v_id;
  insert into public.meeting_items(meeting_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name)
    select v_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name from public.meeting_items where meeting_id=p_meeting_id;
  return v_id;
end $$;

-- Atomic source upsert; unchanged content never rewrites sections.
create or replace function public.upsert_external_song_title_lyrics(
  p_external_source_id uuid,
  p_collection_id uuid,
  p_external_id text,
  p_external_url text,
  p_title text,
  p_lyrics_text text,
  p_sections jsonb,
  p_content_hash text,
  p_overwrite boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref record;
  v_song_id uuid;
  v_result text := 'imported';
begin
  if not public.can_edit_content() and auth.role() is distinct from 'service_role' then
    raise exception 'Nu ai permisiuni pentru sincronizare externă.' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Titlul cântării externe este obligatoriu.';
  end if;

  if nullif(trim(coalesce(p_lyrics_text, '')), '') is null then
    raise exception 'Versurile cântării externe sunt obligatorii.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_external_source_id::text || ':' || p_external_id,42));

  select * into v_ref
  from public.external_song_refs
  where external_source_id = p_external_source_id
    and external_id = p_external_id
  limit 1;

  if v_ref.id is not null and v_ref.song_id is not null and (v_ref.content_hash = p_content_hash or not coalesce(p_overwrite,false)) then
    update public.external_song_refs
    set last_seen_at = now(),
        sync_status = 'skipped'
    where id = v_ref.id;
    return 'skipped';
  end if;

  if v_ref.song_id is not null then
    v_song_id := v_ref.song_id;
    v_result := 'updated';

    update public.songs
    set title = p_title,
        lyrics_text = p_lyrics_text,
        is_active = true
    where id = v_song_id;

    delete from public.song_sections where song_id = v_song_id;
  else
    insert into public.songs (title, lyrics_text, is_active)
    values (p_title, p_lyrics_text, true)
    returning id into v_song_id;

    v_result := 'imported';
  end if;

  if coalesce(jsonb_array_length(coalesce(p_sections, '[]'::jsonb)), 0) > 0 then
    insert into public.song_sections (song_id, section_type, section_label, position, content)
    select
      v_song_id,
      coalesce(nullif(section_item->>'section_type', ''), 'verse'),
      nullif(section_item->>'section_label', ''),
      coalesce((section_item->>'position')::integer, row_number() over ())::integer,
      section_item->>'content'
    from jsonb_array_elements(p_sections) section_item
    where nullif(trim(coalesce(section_item->>'content', '')), '') is not null;
  end if;

  if not exists (select 1 from public.song_sections where song_id = v_song_id) then
    insert into public.song_sections (song_id, section_type, section_label, position, content)
    values (v_song_id, 'verse', 'Strofa 1', 1, p_lyrics_text);
  end if;

  if not exists (
    select 1 from public.song_sources
    where song_id = v_song_id
      and collection_id = p_collection_id
  ) then
    insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
    values (v_song_id, p_collection_id, null, p_title, null);
  end if;

  if v_ref.id is not null then
    update public.external_song_refs
    set song_id = v_song_id,
        collection_id = p_collection_id,
        external_url = p_external_url,
        external_title = p_title,
        external_author = null,
        external_number = null,
        import_mode = 'title_lyrics_only',
        sync_status = v_result,
        content_hash = p_content_hash,
        last_seen_at = now(),
        last_imported_at = now()
    where id = v_ref.id;
  else
    insert into public.external_song_refs (
      external_source_id, song_id, collection_id, external_id, external_url, external_title,
      external_author, external_number, import_mode, sync_status, content_hash, last_seen_at, last_imported_at
    )
    values (
      p_external_source_id, v_song_id, p_collection_id, p_external_id, p_external_url, p_title,
      null, null, 'title_lyrics_only', v_result, p_content_hash, now(), now()
    );
  end if;

  return v_result;
end;
$$;

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
      'notes', m.notes
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

-- Functions default to EXECUTE for PUBLIC in PostgreSQL: revoke explicitly.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('accept_public_meeting_contribution','add_public_meeting_contribution','add_song_to_meeting','add_text_to_meeting','bible_library_stats','can_edit_content','cancel_external_sync','checkpoint_external_scan','claim_external_sync','cleanup_repeated_song_titles_in_sections','commit_external_sync_song','create_meeting','create_meeting_share_link','create_song_category','current_user_role','delete_external_source_songs','duplicate_meeting','enqueue_external_sync','fail_external_sync','find_bible_book_id','find_duplicate_song_candidates','get_bible_reference_text','get_category_song_counts','get_shared_meeting','get_song_recent_usage','get_song_recent_usage_excluding_meeting','import_song_with_sections','import_sync_integrity_report','is_admin','list_song_library','merge_duplicate_songs','move_meeting_item','normalize_ro_text','normalize_song_line_for_cleanup','normalize_song_title_for_duplicates','overwrite_song_with_sections','public_search_songs_for_share','reject_public_meeting_contribution','remove_meeting_item','reorder_meeting_items','search_bible_verses','search_songs','set_bible_book_normalized_fields','set_bible_verse_search_fields','set_song_categories','set_updated_at','slugify_ro','songs_update_search_vector','update_song_metadata','upsert_external_song_title_lyrics')
  loop
    execute format('revoke execute on function %s from public,anon',f.signature);
    if f.proname in ('checkpoint_external_scan','claim_external_sync','commit_external_sync_song','fail_external_sync') then
      execute format('revoke execute on function %s from authenticated',f.signature);
      execute format('grant execute on function %s to service_role',f.signature);
    else
      execute format('grant execute on function %s to authenticated',f.signature);
    end if;
    if f.proname in ('add_public_meeting_contribution','get_shared_meeting','public_search_songs_for_share') then
      execute format('grant execute on function %s to anon',f.signature);
    end if;
  end loop;
end $$;
grant execute on function public.upsert_external_song_title_lyrics(uuid,uuid,text,text,text,text,jsonb,text,boolean) to service_role;
notify pgrst, 'reload schema';

commit;
