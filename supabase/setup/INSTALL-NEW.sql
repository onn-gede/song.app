-- INSTALARE NOUĂ, NUMAI PE O BAZĂ FĂRĂ SONGAPP.
-- Nu include utilizatori, date demonstrative sau importul Bibliei.


-- FILE: 001_init_schema.sql
-- SongApp / Biblioteca de cantari - schema initiala Supabase PostgreSQL
-- Ruleaza acest fisier in Supabase SQL Editor.

create extension if not exists pgcrypto;
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- 1) Tipuri de date
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'worship_leader', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.collection_source_type AS ENUM ('manual', 'pptx', 'ppt', 'pdf', 'txt', 'docx', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.meeting_status AS ENUM ('draft', 'ready', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.meeting_item_type AS ENUM ('song', 'prayer', 'message', 'encouragement', 'text', 'break');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.import_status AS ENUM ('pending', 'parsed', 'needs_review', 'approved', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) Helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3) Useri / profile. id = auth.users.id
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

create or replace function public.can_edit_content()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'editor', 'worship_leader'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- 4) Colectii / carti / baze de cantari
create table if not exists public.song_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_code text not null unique,
  description text,
  source_type public.collection_source_type not null default 'manual',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger song_collections_set_updated_at
before update on public.song_collections
for each row execute function public.set_updated_at();

-- 5) Cantari
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  lyrics_text text,
  default_key text,
  bpm integer check (bpm is null or (bpm between 30 and 260)),
  structure text,
  notes text,
  is_active boolean not null default true,
  search_text text,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.songs_update_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_text := lower(public.unaccent(coalesce(new.title, '') || ' ' || coalesce(new.lyrics_text, '')));
  new.search_vector := to_tsvector('simple', new.search_text);
  return new;
end;
$$;

create trigger songs_set_updated_at
before update on public.songs
for each row execute function public.set_updated_at();

create trigger songs_update_search_vector
before insert or update of title, lyrics_text
on public.songs
for each row execute function public.songs_update_search_vector();

create index if not exists songs_search_vector_idx on public.songs using gin (search_vector);
create index if not exists songs_search_text_trgm_idx on public.songs using gin (search_text gin_trgm_ops);
create index if not exists songs_title_idx on public.songs (title);

-- 6) Fisiere importate
create table if not exists public.song_files (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references public.song_collections(id) on delete set null,
  song_id uuid references public.songs(id) on delete set null,
  file_name text not null,
  file_type public.collection_source_type not null default 'other',
  storage_path text,
  import_status public.import_status not null default 'pending',
  parsed_text text,
  parser_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger song_files_set_updated_at
before update on public.song_files
for each row execute function public.set_updated_at();

-- 7) Numarul cantarii in fiecare colectie/carte
create table if not exists public.song_sources (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  collection_id uuid not null references public.song_collections(id) on delete cascade,
  song_number text,
  source_title text,
  source_file_id uuid references public.song_files(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(collection_id, song_number, source_title)
);

create index if not exists song_sources_song_id_idx on public.song_sources(song_id);
create index if not exists song_sources_collection_number_idx on public.song_sources(collection_id, song_number);

-- 8) Strofe / refrene / parti
create table if not exists public.song_sections (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  section_type text not null default 'verse',
  section_label text,
  position integer not null default 1,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists song_sections_song_position_idx on public.song_sections(song_id, position);

-- 9) Categorii tematice
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.song_categories (
  song_id uuid not null references public.songs(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (song_id, category_id)
);

-- 10) Intalniri / programe
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_type text,
  meeting_date timestamptz not null,
  status public.meeting_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger meetings_set_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

create table if not exists public.meeting_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  position integer not null,
  item_type public.meeting_item_type not null default 'song',
  song_id uuid references public.songs(id) on delete set null,
  custom_title text,
  custom_text text,
  selected_key text,
  selected_bpm integer check (selected_bpm is null or (selected_bpm between 30 and 260)),
  is_backup boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique(meeting_id, position)
);

create index if not exists meeting_items_meeting_position_idx on public.meeting_items(meeting_id, position);
create index if not exists meeting_items_song_id_idx on public.meeting_items(song_id);

-- 11) Linkuri publice de share pentru un program concret
create table if not exists public.meeting_share_links (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  public_slug text not null unique,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists meeting_share_links_meeting_id_idx on public.meeting_share_links(meeting_id);

-- 12) Referinte biblice potrivite pentru cantari
create table if not exists public.bible_references (
  id uuid primary key default gen_random_uuid(),
  version text not null default 'Dumitru Cornilescu revizuita',
  book text not null,
  chapter integer not null,
  verse_start integer not null,
  verse_end integer,
  reference_label text not null,
  text_cache text,
  source_url text,
  copyright_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.song_bible_references (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  bible_reference_id uuid not null references public.bible_references(id) on delete cascade,
  theme text,
  reason text,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(song_id, bible_reference_id, theme)
);

-- 13) Functii utile
create or replace function public.search_songs(search_query text, result_limit integer default 50)
returns table (
  song_id uuid,
  title text,
  default_key text,
  bpm integer,
  rank real,
  matched_source text
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select lower(public.unaccent(coalesce(search_query, ''))) as term
  )
  select
    s.id as song_id,
    s.title,
    s.default_key,
    s.bpm,
    greatest(
      coalesce(ts_rank_cd(s.search_vector, plainto_tsquery('simple', q.term)), 0),
      coalesce(similarity(s.search_text, q.term), 0)
    )::real as rank,
    string_agg(distinct coalesce(sc.short_code || ' nr. ' || ss.song_number, sc.short_code), ', ') as matched_source
  from public.songs s
  cross join q
  left join public.song_sources ss on ss.song_id = s.id
  left join public.song_collections sc on sc.id = ss.collection_id
  where s.is_active = true
    and (
      s.search_vector @@ plainto_tsquery('simple', q.term)
      or s.search_text % q.term
      or s.search_text ilike '%' || q.term || '%'
    )
  group by s.id, s.title, s.default_key, s.bpm, s.search_vector, s.search_text, q.term
  order by rank desc, s.title asc
  limit result_limit;
$$;

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
security definer
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
    'items', coalesce(jsonb_agg(
      jsonb_build_object(
        'position', mi.position,
        'item_type', mi.item_type,
        'is_backup', mi.is_backup,
        'custom_title', mi.custom_title,
        'custom_text', mi.custom_text,
        'selected_key', mi.selected_key,
        'selected_bpm', mi.selected_bpm,
        'notes', mi.notes,
        'song', case when s.id is null then null else jsonb_build_object(
          'title', s.title,
          'lyrics_text', s.lyrics_text,
          'default_key', s.default_key,
          'bpm', s.bpm,
          'structure', s.structure
        ) end
      ) order by mi.position
    ) filter (where mi.id is not null), '[]'::jsonb)
  )
  from public.meeting_share_links l
  join public.meetings m on m.id = l.meeting_id
  left join public.meeting_items mi on mi.meeting_id = m.id
  left join public.songs s on s.id = mi.song_id
  where l.public_slug = p_public_slug
    and l.is_active = true
    and (l.expires_at is null or l.expires_at > now())
  group by m.id, m.title, m.meeting_type, m.meeting_date, m.notes;
$$;

-- 14) Row Level Security
alter table public.profiles enable row level security;
alter table public.song_collections enable row level security;
alter table public.songs enable row level security;
alter table public.song_files enable row level security;
alter table public.song_sources enable row level security;
alter table public.song_sections enable row level security;
alter table public.categories enable row level security;
alter table public.song_categories enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_items enable row level security;
alter table public.meeting_share_links enable row level security;
alter table public.bible_references enable row level security;
alter table public.song_bible_references enable row level security;

-- Politici simple pentru MVP: userii autentificati citesc, editorii/adminii/liderii modifica.
DO $$ BEGIN
  CREATE POLICY "profiles_read_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() or public.is_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_admin_manage" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "collections_read_auth" ON public.song_collections
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "collections_manage_editors" ON public.song_collections
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "songs_read_auth" ON public.songs
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "songs_manage_editors" ON public.songs
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "song_related_read_auth" ON public.song_sources
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "song_sources_manage_editors" ON public.song_sources
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "song_sections_read_auth" ON public.song_sections
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "song_sections_manage_editors" ON public.song_sections
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "song_files_read_auth" ON public.song_files
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "song_files_manage_editors" ON public.song_files
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "categories_read_auth" ON public.categories
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "categories_manage_editors" ON public.categories
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "song_categories_read_auth" ON public.song_categories
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "song_categories_manage_editors" ON public.song_categories
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "meetings_read_auth" ON public.meetings
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "meetings_manage_editors" ON public.meetings
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "meeting_items_read_auth" ON public.meeting_items
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "meeting_items_manage_editors" ON public.meeting_items
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "share_links_read_auth" ON public.meeting_share_links
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "share_links_manage_editors" ON public.meeting_share_links
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "bible_refs_read_auth" ON public.bible_references
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "bible_refs_manage_editors" ON public.bible_references
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "song_bible_refs_read_auth" ON public.song_bible_references
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "song_bible_refs_manage_editors" ON public.song_bible_references
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Permite apelarea functiei de share public fara login.
grant execute on function public.get_shared_meeting(text) to anon, authenticated;
grant execute on function public.search_songs(text, integer) to authenticated;
grant execute on function public.get_song_recent_usage(integer) to authenticated;


-- FILE: 002_seed_core_data.sql
-- Date initiale: colectii si categorii de baza
insert into public.song_collections (name, short_code, description, source_type)
values
  ('Tineri', 'TINERI', 'Lista de cantari pentru tineri', 'pptx'),
  ('Cantarile Evangheliei - carte rosie', 'CE_ROSIE', 'Colectia Cantarile Evangheliei - carte rosie', 'manual'),
  ('Cantarile Evangheliei - carte neagra', 'CE_NEAGRA', 'Colectia Cantarile Evangheliei - carte neagra', 'manual')
on conflict (short_code) do update set
  name = excluded.name,
  description = excluded.description,
  source_type = excluded.source_type;

insert into public.categories (name, slug)
values
  ('Paste', 'paste'),
  ('Nasterea Domnului', 'nasterea-domnului'),
  ('Botez', 'botez'),
  ('Cina Domnului', 'cina-domnului'),
  ('Sarbatoarea multumirii', 'sarbatoarea-multumirii'),
  ('Inmormantare', 'inmormantare'),
  ('Tineri', 'tineri'),
  ('Evanghelizare', 'evanghelizare'),
  ('Inchinare', 'inchinare'),
  ('Rugaciune', 'rugaciune'),
  ('Chemare la pocainta', 'chemare-la-pocainta'),
  ('Credinta', 'credinta'),
  ('Mangaiere', 'mangaiere')
on conflict (slug) do update set name = excluded.name;


-- FILE: 005_app_helper_functions.sql
-- SongApp MVP helpers
-- Rulează după 001, 002, 003 și după importul cântărilor.

create or replace function public.create_meeting(
  p_title text,
  p_meeting_type text default null,
  p_meeting_date timestamptz default now(),
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să creezi programe.';
  end if;

  insert into public.meetings (title, meeting_type, meeting_date, notes, created_by)
  values (p_title, p_meeting_type, p_meeting_date, p_notes, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_meeting(text, text, timestamptz, text) to authenticated;

create or replace function public.add_song_to_meeting(
  p_meeting_id uuid,
  p_song_id uuid,
  p_is_backup boolean default false,
  p_selected_key text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_position integer;
  v_song_key text;
  v_song_bpm integer;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  if not exists (select 1 from public.meetings where id = p_meeting_id) then
    raise exception 'Programul nu există.';
  end if;

  select default_key, bpm into v_song_key, v_song_bpm
  from public.songs
  where id = p_song_id and is_active = true;

  if p_is_backup then
    select coalesce(max(position), 900) + 1
      into v_position
    from public.meeting_items
    where meeting_id = p_meeting_id
      and position >= 900;
  else
    select coalesce(max(position), 0) + 1
      into v_position
    from public.meeting_items
    where meeting_id = p_meeting_id
      and position < 900;
  end if;

  insert into public.meeting_items (
    meeting_id,
    position,
    item_type,
    song_id,
    selected_key,
    selected_bpm,
    is_backup,
    notes
  )
  values (
    p_meeting_id,
    v_position,
    'song',
    p_song_id,
    coalesce(p_selected_key, v_song_key),
    v_song_bpm,
    p_is_backup,
    p_notes
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_song_to_meeting(uuid, uuid, boolean, text, text) to authenticated;

create or replace function public.add_text_to_meeting(
  p_meeting_id uuid,
  p_item_type text default 'text',
  p_custom_title text default null,
  p_custom_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_position integer;
  v_item_type public.meeting_item_type;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  v_item_type := case
    when p_item_type in ('song', 'prayer', 'message', 'encouragement', 'text', 'break') then p_item_type::public.meeting_item_type
    else 'text'::public.meeting_item_type
  end;

  select coalesce(max(position), 0) + 1
    into v_position
  from public.meeting_items
  where meeting_id = p_meeting_id
    and position < 900;

  insert into public.meeting_items (
    meeting_id,
    position,
    item_type,
    custom_title,
    custom_text
  )
  values (
    p_meeting_id,
    v_position,
    v_item_type,
    p_custom_title,
    p_custom_text
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_text_to_meeting(uuid, text, text, text) to authenticated;

create or replace function public.create_meeting_share_link(
  p_meeting_id uuid,
  p_preferred_slug text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_slug text;
  v_base text;
  v_suffix text;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să creezi link public.';
  end if;

  select title into v_title from public.meetings where id = p_meeting_id;
  if v_title is null then
    raise exception 'Programul nu există.';
  end if;

  v_base := lower(public.unaccent(coalesce(nullif(p_preferred_slug, ''), v_title)));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if length(v_base) < 3 then
    v_base := 'program';
  end if;

  v_suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_slug := left(v_base, 70) || '-' || v_suffix;

  insert into public.meeting_share_links (meeting_id, public_slug, is_active, created_by)
  values (p_meeting_id, v_slug, true, auth.uid());

  return v_slug;
end;
$$;

grant execute on function public.create_meeting_share_link(uuid, text) to authenticated;

create or replace function public.remove_meeting_item(
  p_meeting_id uuid,
  p_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  delete from public.meeting_items
  where id = p_item_id
    and meeting_id = p_meeting_id;

  return true;
end;
$$;

grant execute on function public.remove_meeting_item(uuid, uuid) to authenticated;


-- FILE: 006_meeting_reorder_and_stability.sql
-- SongApp MVP fix v2
-- Rulează după 005_app_helper_functions.sql.
-- Adaugă mutarea elementelor în program și stabilizează ștergerea.

create or replace function public.move_meeting_item(
  p_meeting_id uuid,
  p_item_id uuid,
  p_direction text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_position integer;
  v_current_is_backup boolean;
  v_target_id uuid;
  v_target_position integer;
  v_temp_position integer;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  select position, is_backup
    into v_current_position, v_current_is_backup
  from public.meeting_items
  where id = p_item_id
    and meeting_id = p_meeting_id;

  if v_current_position is null then
    raise exception 'Elementul nu există în acest program.';
  end if;

  if p_direction = 'up' then
    select id, position
      into v_target_id, v_target_position
    from public.meeting_items
    where meeting_id = p_meeting_id
      and is_backup = v_current_is_backup
      and position < v_current_position
    order by position desc
    limit 1;
  elsif p_direction = 'down' then
    select id, position
      into v_target_id, v_target_position
    from public.meeting_items
    where meeting_id = p_meeting_id
      and is_backup = v_current_is_backup
      and position > v_current_position
    order by position asc
    limit 1;
  else
    raise exception 'Direcția trebuie să fie up sau down.';
  end if;

  if v_target_id is null then
    return false;
  end if;

  v_temp_position := -1000000000 - floor(random() * 1000000)::integer;

  update public.meeting_items
  set position = v_temp_position
  where id = p_item_id
    and meeting_id = p_meeting_id;

  update public.meeting_items
  set position = v_current_position
  where id = v_target_id
    and meeting_id = p_meeting_id;

  update public.meeting_items
  set position = v_target_position
  where id = p_item_id
    and meeting_id = p_meeting_id;

  return true;
end;
$$;

grant execute on function public.move_meeting_item(uuid, uuid, text) to authenticated;

create or replace function public.remove_meeting_item(
  p_meeting_id uuid,
  p_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  delete from public.meeting_items
  where id = p_item_id
    and meeting_id = p_meeting_id;

  return true;
end;
$$;

grant execute on function public.remove_meeting_item(uuid, uuid) to authenticated;


-- FILE: 007_song_metadata_categories.sql
-- SongApp fix v4: administrare cântări + categorii
-- Rulează acest fișier după 006_meeting_reorder_and_stability.sql.

create or replace function public.slugify_ro(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(lower(public.unaccent(coalesce(p_value, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

grant execute on function public.slugify_ro(text) to authenticated;

create or replace function public.create_song_category(
  p_name text,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_base_slug text;
  v_slug text;
  v_id uuid;
  v_counter integer := 1;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să creezi categorii.';
  end if;

  v_name := nullif(trim(p_name), '');
  if v_name is null then
    raise exception 'Numele categoriei este obligatoriu.';
  end if;

  if p_parent_id is not null and not exists (select 1 from public.categories where id = p_parent_id) then
    raise exception 'Categoria părinte nu există.';
  end if;

  v_base_slug := public.slugify_ro(v_name);
  if length(v_base_slug) < 2 then
    v_base_slug := 'categorie';
  end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.categories where slug = v_slug) loop
    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter::text;
  end loop;

  insert into public.categories (name, slug, parent_id)
  values (v_name, v_slug, p_parent_id)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_song_category(text, uuid) to authenticated;

create or replace function public.update_song_metadata(
  p_song_id uuid,
  p_title text,
  p_default_key text default null,
  p_bpm integer default null,
  p_structure text default null,
  p_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să editezi cântări.';
  end if;

  v_title := nullif(trim(p_title), '');
  if v_title is null then
    raise exception 'Titlul cântării este obligatoriu.';
  end if;

  if p_bpm is not null and (p_bpm < 30 or p_bpm > 260) then
    raise exception 'BPM trebuie să fie între 30 și 260.';
  end if;

  update public.songs
  set
    title = v_title,
    default_key = nullif(trim(coalesce(p_default_key, '')), ''),
    bpm = p_bpm,
    structure = nullif(trim(coalesce(p_structure, '')), ''),
    notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_song_id;

  if not found then
    raise exception 'Cântarea nu există.';
  end if;

  return true;
end;
$$;

grant execute on function public.update_song_metadata(uuid, text, text, integer, text, text) to authenticated;

create or replace function public.set_song_categories(
  p_song_id uuid,
  p_category_ids uuid[] default array[]::uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să editezi categoriile cântării.';
  end if;

  if not exists (select 1 from public.songs where id = p_song_id) then
    raise exception 'Cântarea nu există.';
  end if;

  delete from public.song_categories
  where song_id = p_song_id;

  insert into public.song_categories (song_id, category_id)
  select p_song_id, category_id
  from unnest(coalesce(p_category_ids, array[]::uuid[])) as category_id
  where exists (select 1 from public.categories c where c.id = category_id)
  on conflict do nothing;

  return true;
end;
$$;

grant execute on function public.set_song_categories(uuid, uuid[]) to authenticated;

create or replace function public.get_category_song_counts()
returns table (
  category_id uuid,
  songs_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select category_id, count(*)::bigint as songs_count
  from public.song_categories
  group by category_id;
$$;

grant execute on function public.get_category_song_counts() to authenticated;


-- FILE: 008_no_sql_needed_v7.sql
-- SongApp v7
-- Nu este necesară nicio modificare de schemă pentru acest update.
-- Fișierul există doar ca reper de versiune.
select 'SongApp v7: no database schema changes required' as status;


-- FILE: 009_storage_file_import.sql
-- v9: bucket privat pentru fișierele sursă ale cântărilor și politici Storage.
-- Rulează o singură dată în Supabase SQL Editor înainte de importul PPTX/PDF/TXT.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'song-files',
  'song-files',
  false,
  26214400,
  array[
    'text/plain',
    'text/markdown',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DO $$ BEGIN
  CREATE POLICY "song_files_storage_read_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'song-files');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "song_files_storage_insert_editors" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'song-files' and public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "song_files_storage_update_editors" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'song-files' and public.can_edit_content())
  WITH CHECK (bucket_id = 'song-files' and public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "song_files_storage_delete_editors" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'song-files' and public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

NOTIFY pgrst, 'reload schema';


-- FILE: 010_program_drag_share_print.sql
-- SongApp v10
-- Rulează după 006_meeting_reorder_and_stability.sql.
-- Adaugă reordonare prin drag & drop pentru grupul principal și grupul backup.

create or replace function public.reorder_meeting_items(
  p_meeting_id uuid,
  p_item_ids uuid[],
  p_is_backup boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_count integer;
  v_received_count integer;
  v_base integer;
  v_item_id uuid;
  v_index integer := 1;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  if p_meeting_id is null then
    raise exception 'Lipsește programul.';
  end if;

  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    return true;
  end if;

  select count(*)
    into v_expected_count
  from public.meeting_items
  where meeting_id = p_meeting_id
    and is_backup = p_is_backup;

  v_received_count := array_length(p_item_ids, 1);

  if v_expected_count <> v_received_count then
    raise exception 'Lista primită nu conține toate elementele din acest grup. Reîncarcă pagina și încearcă din nou.';
  end if;

  if exists (
    select 1
    from unnest(p_item_ids) as input_id(id)
    left join public.meeting_items mi
      on mi.id = input_id.id
     and mi.meeting_id = p_meeting_id
     and mi.is_backup = p_is_backup
    where mi.id is null
  ) then
    raise exception 'Lista conține elemente invalide pentru acest program.';
  end if;

  v_base := case when p_is_backup then 900 else 0 end;

  -- Evită conflictul cu unique(meeting_id, position) prin poziții temporare negative.
  v_index := 1;
  foreach v_item_id in array p_item_ids loop
    update public.meeting_items
    set position = -1000000 - v_index
    where id = v_item_id
      and meeting_id = p_meeting_id
      and is_backup = p_is_backup;
    v_index := v_index + 1;
  end loop;

  v_index := 1;
  foreach v_item_id in array p_item_ids loop
    update public.meeting_items
    set position = v_base + v_index
    where id = v_item_id
      and meeting_id = p_meeting_id
      and is_backup = p_is_backup;
    v_index := v_index + 1;
  end loop;

  return true;
end;
$$;

grant execute on function public.reorder_meeting_items(uuid, uuid[], boolean) to authenticated;


-- FILE: 012_no_sql_needed_v13.sql
-- v13 nu necesită modificări de schemă.
-- Tabelele folosite există deja în schema inițială:
-- public.bible_references
-- public.song_bible_references

NOTIFY pgrst, 'reload schema';


-- FILE: 013_no_sql_needed_v14.sql
-- v14: Nu este necesar SQL nou.
-- Sugestiile de versete sunt generate în aplicație și se salvează în tabelele existente:
-- public.bible_references
-- public.song_bible_references
NOTIFY pgrst, 'reload schema';


-- FILE: 014_no_sql_needed_v17.sql
-- v17 nu necesită modificări de schemă.
-- Opțional: forțează reîncărcarea schema cache PostgREST.
NOTIFY pgrst, 'reload schema';


-- FILE: 015_no_sql_needed_v19.sql
-- v19: nu sunt necesare modificări SQL.
-- UI: prezentare fullscreen îmbunătățită, filtre persistente și design compact.
NOTIFY pgrst, 'reload schema';


-- FILE: 016_no_sql_needed_v20.sql
-- v20: nu sunt necesare modificări SQL.
-- Patch-ul schimbă UI-ul paginii de cântare, stilurile globale și curățarea textului la import.
NOTIFY pgrst, 'reload schema';


-- FILE: 017_no_sql_needed_v21.sql
-- v21: nu este nevoie de modificări SQL.
-- Suportul pentru .ppt este implementat în aplicație, prin conversie locală în .pptx cu LibreOffice.
-- Opțional, rulează pentru reload schema cache:
NOTIFY pgrst, 'reload schema';


-- FILE: 018_no_sql_needed_v22.sql
-- v22 nu necesită modificări în schema Supabase.
-- Opțional, poți rula comanda de mai jos dacă vrei să forțezi reload schema cache:
notify pgrst, 'reload schema';


-- FILE: 019_external_sources_sync.sql
-- v25: surse externe / sincronizare cântări

create table if not exists public.external_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  base_url text not null,
  collection_id uuid references public.song_collections(id) on delete set null,
  sync_mode text not null default 'full_import',
  license_label text,
  license_url text,
  permission_notes text,
  is_enabled boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  create trigger external_sources_set_updated_at
  before update on public.external_sources
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

create table if not exists public.external_song_refs (
  id uuid primary key default gen_random_uuid(),
  external_source_id uuid not null references public.external_sources(id) on delete cascade,
  song_id uuid references public.songs(id) on delete set null,
  collection_id uuid references public.song_collections(id) on delete set null,
  external_id text not null,
  external_url text not null,
  external_title text not null,
  external_author text,
  external_number text,
  import_mode text not null default 'full_import',
  sync_status text not null default 'imported',
  content_hash text,
  last_seen_at timestamptz not null default now(),
  last_imported_at timestamptz,
  created_at timestamptz not null default now(),
  unique(external_source_id, external_id)
);

create index if not exists external_song_refs_song_id_idx on public.external_song_refs(song_id);
create index if not exists external_song_refs_collection_idx on public.external_song_refs(collection_id);

create table if not exists public.external_sync_runs (
  id uuid primary key default gen_random_uuid(),
  external_source_id uuid references public.external_sources(id) on delete set null,
  status text not null default 'running',
  pages_scanned integer not null default 0,
  found_count integer not null default 0,
  imported_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

insert into public.song_collections (name, short_code, description, source_type, is_active)
values
  ('Resurse Creștine', 'RESURSE_CRESTINE', 'Colecție sincronizabilă din resursecrestine.ro. Import limitat la titlu și versuri.', 'other', true),
  ('Melodia.ro', 'MELODIA_RO', 'Colecție sincronizabilă din melodia.ro. Import limitat la titlu și versuri, pe baza permisiunii confirmate.', 'other', true)
on conflict (short_code) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into public.external_sources (name, slug, base_url, collection_id, sync_mode, license_label, license_url, permission_notes, is_enabled)
select 'Resurse Creștine', 'resursecrestine', 'https://www.resursecrestine.ro', c.id,
       'title_lyrics_only', 'CC BY-NC-SA', 'https://www.resursecrestine.ro/termeni-si-conditii',
       'Sincronizare limitată la titlu și versuri.', true
from public.song_collections c where c.short_code = 'RESURSE_CRESTINE'
on conflict (slug) do update set collection_id = excluded.collection_id, is_enabled = true;

insert into public.external_sources (name, slug, base_url, collection_id, sync_mode, license_label, license_url, permission_notes, is_enabled)
select 'Melodia.ro', 'melodia', 'https://melodia.ro', c.id,
       'title_lyrics_only', 'Permisiune furnizată de utilizator', 'https://melodia.ro/termeni',
       'Sincronizare limitată la titlu și versuri, pe baza permisiunii confirmate de utilizator.', true
from public.song_collections c where c.short_code = 'MELODIA_RO'
on conflict (slug) do update set collection_id = excluded.collection_id, sync_mode = excluded.sync_mode, permission_notes = excluded.permission_notes, is_enabled = true;

notify pgrst, 'reload schema';


-- FILE: 020_external_sources_title_lyrics_only.sql
-- v26: external sources title + lyrics only
-- This keeps the external source collections, but marks sync mode and descriptions as limited to title and lyrics.

update public.song_collections
set description = 'Colecție sincronizabilă din resursecrestine.ro. Import limitat la titlu și versuri.'
where short_code = 'RESURSE_CRESTINE';

update public.song_collections
set description = 'Colecție sincronizabilă din melodia.ro. Import limitat la titlu și versuri, pe baza permisiunii confirmate.'
where short_code = 'MELODIA_RO';

update public.external_sources
set sync_mode = 'title_lyrics_only',
    permission_notes = 'Sincronizare limitată la titlu și versuri.'
where slug = 'resursecrestine';

update public.external_sources
set sync_mode = 'title_lyrics_only',
    permission_notes = 'Sincronizare limitată la titlu și versuri, pe baza permisiunii confirmate de utilizator.'
where slug = 'melodia';

notify pgrst, 'reload schema';


-- FILE: 021_external_sources_rls.sql
-- v26.1: RLS policies for external source synchronization
-- Run after 019/020 or combined 019+020. This lets authenticated editors/admins manage external source sync tables.

alter table if exists public.external_sources enable row level security;
alter table if exists public.external_song_refs enable row level security;
alter table if exists public.external_sync_runs enable row level security;

DO $$ BEGIN
  CREATE POLICY "external_sources_read_auth" ON public.external_sources
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "external_sources_manage_editors" ON public.external_sources
  FOR ALL TO authenticated
  USING (public.can_edit_content())
  WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "external_song_refs_read_auth" ON public.external_song_refs
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "external_song_refs_manage_editors" ON public.external_song_refs
  FOR ALL TO authenticated
  USING (public.can_edit_content())
  WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "external_sync_runs_read_auth" ON public.external_sync_runs
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "external_sync_runs_manage_editors" ON public.external_sync_runs
  FOR ALL TO authenticated
  USING (public.can_edit_content())
  WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

grant select, insert, update, delete on public.external_sources to authenticated;
grant select, insert, update, delete on public.external_song_refs to authenticated;
grant select, insert, update, delete on public.external_sync_runs to authenticated;

notify pgrst, 'reload schema';


-- FILE: 022_v28_disable_melodia_external_source.sql
-- v28: dezactivează Melodia.ro din modulul de surse externe.
-- Nu șterge cântările deja importate; doar ascunde/dezactivează sursa pentru sincronizări noi.

update public.external_sources
set is_enabled = false,
    updated_at = now()
where slug = 'melodia';

notify pgrst, 'reload schema';


-- FILE: 023_v29_external_review_cleanup.sql
-- v29: control mai bun pentru sursele externe / curățare importuri Resurse Creștine

create or replace function public.delete_external_source_songs(p_source_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_id uuid;
  v_song_ids uuid[];
  v_deleted_refs integer := 0;
  v_deleted_songs integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Doar administratorii pot șterge importurile unei surse externe.';
  end if;

  select id into v_source_id
  from public.external_sources
  where slug = p_source_slug
  limit 1;

  if v_source_id is null then
    return jsonb_build_object('deleted_refs', 0, 'deleted_songs', 0, 'message', 'Sursa nu există.');
  end if;

  select coalesce(array_agg(distinct song_id) filter (where song_id is not null), array[]::uuid[])
  into v_song_ids
  from public.external_song_refs
  where external_source_id = v_source_id;

  delete from public.external_song_refs
  where external_source_id = v_source_id;
  get diagnostics v_deleted_refs = row_count;

  if array_length(v_song_ids, 1) is not null then
    delete from public.songs
    where id = any(v_song_ids);
    get diagnostics v_deleted_songs = row_count;
  end if;

  update public.external_sources
  set last_synced_at = null
  where id = v_source_id;

  return jsonb_build_object(
    'deleted_refs', v_deleted_refs,
    'deleted_songs', v_deleted_songs,
    'message', 'Importul extern a fost șters.'
  );
end;
$$;

grant execute on function public.delete_external_source_songs(text) to authenticated;

notify pgrst, 'reload schema';


-- FILE: 024_v30_duplicate_tools.sql
-- v30: instrumente pentru detectarea și unificarea cântărilor duplicate

create or replace function public.normalize_song_title_for_duplicates(p_title text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    regexp_replace(
      lower(public.unaccent(coalesce(p_title, ''))),
      '\\b(ale?luia|amin|cantare|cantec|imn)\\b',
      '',
      'g'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

create or replace function public.find_duplicate_song_candidates(p_limit integer default 50)
returns table (
  group_key text,
  title_hint text,
  song_count integer,
  songs jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      s.id,
      s.title,
      s.default_key,
      s.bpm,
      s.created_at,
      public.normalize_song_title_for_duplicates(s.title) as group_key,
      coalesce(string_agg(distinct c.name, ', ' order by c.name), '') as collections,
      coalesce(string_agg(distinct ss.song_number, ', ' order by ss.song_number) filter (where ss.song_number is not null and ss.song_number <> ''), '') as numbers,
      length(coalesce(s.lyrics_text, '')) as lyrics_length
    from public.songs s
    left join public.song_sources ss on ss.song_id = s.id
    left join public.song_collections c on c.id = ss.collection_id
    group by s.id
  ), grouped as (
    select
      n.group_key,
      min(n.title) as title_hint,
      count(*)::integer as song_count,
      jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'title', n.title,
          'default_key', n.default_key,
          'bpm', n.bpm,
          'created_at', n.created_at,
          'collections', n.collections,
          'numbers', n.numbers,
          'lyrics_length', n.lyrics_length
        ) order by n.lyrics_length desc, n.created_at asc
      ) as songs
    from normalized n
    where length(n.group_key) >= 4
    group by n.group_key
    having count(*) > 1
  )
  select g.group_key, g.title_hint, g.song_count, g.songs
  from grouped g
  order by g.song_count desc, g.title_hint asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

grant execute on function public.find_duplicate_song_candidates(integer) to authenticated;

create or replace function public.merge_duplicate_songs(p_primary_song_id uuid, p_duplicate_song_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duplicates uuid[];
  v_duplicate_count integer := 0;
  v_moved_meeting_items integer := 0;
  v_moved_files integer := 0;
  v_moved_external_refs integer := 0;
  v_moved_sources integer := 0;
  v_moved_categories integer := 0;
  v_moved_bible_refs integer := 0;
  v_deleted_songs integer := 0;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai drepturi pentru unificarea cântărilor.';
  end if;

  if p_primary_song_id is null then
    raise exception 'Lipsește cântarea principală.';
  end if;

  if not exists (select 1 from public.songs where id = p_primary_song_id) then
    raise exception 'Cântarea principală nu există.';
  end if;

  select coalesce(array_agg(distinct id), array[]::uuid[])
  into v_duplicates
  from unnest(coalesce(p_duplicate_song_ids, array[]::uuid[])) as id
  where id is not null
    and id <> p_primary_song_id
    and exists (select 1 from public.songs s where s.id = id);

  v_duplicate_count := coalesce(array_length(v_duplicates, 1), 0);

  if v_duplicate_count = 0 then
    return jsonb_build_object('merged', 0, 'message', 'Nu ai selectat duplicate de unificat.');
  end if;

  update public.meeting_items
  set song_id = p_primary_song_id
  where song_id = any(v_duplicates);
  get diagnostics v_moved_meeting_items = row_count;

  update public.song_files
  set song_id = p_primary_song_id
  where song_id = any(v_duplicates);
  get diagnostics v_moved_files = row_count;

  update public.external_song_refs
  set song_id = p_primary_song_id
  where song_id = any(v_duplicates);
  get diagnostics v_moved_external_refs = row_count;

  insert into public.song_categories (song_id, category_id)
  select distinct p_primary_song_id, sc.category_id
  from public.song_categories sc
  where sc.song_id = any(v_duplicates)
  on conflict do nothing;
  get diagnostics v_moved_categories = row_count;

  insert into public.song_bible_references (song_id, bible_reference_id, theme, reason, confidence, created_by)
  select distinct p_primary_song_id, sbr.bible_reference_id, sbr.theme, sbr.reason, sbr.confidence, sbr.created_by
  from public.song_bible_references sbr
  where sbr.song_id = any(v_duplicates)
  on conflict do nothing;
  get diagnostics v_moved_bible_refs = row_count;

  insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id, created_at)
  select distinct p_primary_song_id, ss.collection_id, ss.song_number, ss.source_title, ss.source_file_id, ss.created_at
  from public.song_sources ss
  where ss.song_id = any(v_duplicates)
  on conflict do nothing;
  get diagnostics v_moved_sources = row_count;

  delete from public.song_sources where song_id = any(v_duplicates);

  delete from public.songs where id = any(v_duplicates);
  get diagnostics v_deleted_songs = row_count;

  return jsonb_build_object(
    'merged', v_deleted_songs,
    'duplicate_count', v_duplicate_count,
    'moved_meeting_items', v_moved_meeting_items,
    'moved_files', v_moved_files,
    'moved_external_refs', v_moved_external_refs,
    'moved_sources', v_moved_sources,
    'moved_categories', v_moved_categories,
    'moved_bible_refs', v_moved_bible_refs,
    'message', 'Duplicatele selectate au fost unificate.'
  );
end;
$$;

grant execute on function public.merge_duplicate_songs(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';


-- FILE: 025_v31_import_sync_integrity.sql
-- v31: import/sync integrity helpers
-- Scop: importurile noi și sincronizările externe se salvează atomic în DB.
-- Dacă o etapă eșuează, nu rămân cântări parțiale fără secțiuni/sursă/import.

create or replace function public.import_song_with_sections(
  p_collection_id uuid,
  p_title text,
  p_song_number text,
  p_lyrics_text text,
  p_sections jsonb,
  p_file_name text,
  p_file_type text,
  p_parser_notes text,
  p_default_key text default null,
  p_bpm integer default null,
  p_structure text default null,
  p_notes text default null,
  p_storage_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_song_id uuid;
  v_file_id uuid;
  v_source_title text;
  v_file_type public.collection_source_type;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiuni pentru import.' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Titlul cântării este obligatoriu.';
  end if;

  if nullif(trim(coalesce(p_lyrics_text, '')), '') is null then
    raise exception 'Versurile cântării sunt obligatorii.';
  end if;

  if p_bpm is not null and (p_bpm < 30 or p_bpm > 260) then
    raise exception 'BPM trebuie să fie între 30 și 260.';
  end if;

  v_source_title := trim(p_title);

  begin
    v_file_type := coalesce(nullif(p_file_type, ''), 'other')::public.collection_source_type;
  exception when others then
    v_file_type := 'other'::public.collection_source_type;
  end;

  insert into public.songs (title, lyrics_text, default_key, bpm, structure, notes, is_active)
  values (v_source_title, p_lyrics_text, p_default_key, p_bpm, p_structure, p_notes, true)
  returning id into v_song_id;

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

  insert into public.song_files (collection_id, song_id, file_name, file_type, storage_path, import_status, parsed_text, parser_notes)
  values (p_collection_id, v_song_id, coalesce(nullif(p_file_name, ''), v_source_title || '.txt'), v_file_type, p_storage_path, 'needs_review', p_lyrics_text, p_parser_notes)
  returning id into v_file_id;

  begin
    insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
    values (v_song_id, p_collection_id, nullif(p_song_number, ''), v_source_title, v_file_id);
  exception when unique_violation then
    insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
    values (
      v_song_id,
      p_collection_id,
      nullif(p_song_number, ''),
      v_source_title || ' (import ' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || ')',
      v_file_id
    );
  end;

  return v_song_id;
end;
$$;

create or replace function public.overwrite_song_with_sections(
  p_song_id uuid,
  p_collection_id uuid,
  p_title text,
  p_song_number text,
  p_lyrics_text text,
  p_sections jsonb,
  p_file_name text,
  p_file_type text,
  p_parser_notes text,
  p_default_key text default null,
  p_bpm integer default null,
  p_structure text default null,
  p_notes text default null,
  p_storage_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file_id uuid;
  v_source_id uuid;
  v_source_title text;
  v_file_type public.collection_source_type;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiuni pentru suprascriere import.' using errcode = '42501';
  end if;

  if p_song_id is null then
    raise exception 'Lipsește cântarea țintă pentru suprascriere.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Titlul cântării este obligatoriu.';
  end if;

  if nullif(trim(coalesce(p_lyrics_text, '')), '') is null then
    raise exception 'Versurile cântării sunt obligatorii.';
  end if;

  if p_bpm is not null and (p_bpm < 30 or p_bpm > 260) then
    raise exception 'BPM trebuie să fie între 30 și 260.';
  end if;

  v_source_title := trim(p_title);

  begin
    v_file_type := coalesce(nullif(p_file_type, ''), 'other')::public.collection_source_type;
  exception when others then
    v_file_type := 'other'::public.collection_source_type;
  end;

  update public.songs
  set title = v_source_title,
      lyrics_text = p_lyrics_text,
      default_key = p_default_key,
      bpm = p_bpm,
      structure = p_structure,
      notes = p_notes,
      is_active = true
  where id = p_song_id;

  if not found then
    raise exception 'Cântarea țintă nu există.';
  end if;

  delete from public.song_sections where song_id = p_song_id;

  if coalesce(jsonb_array_length(coalesce(p_sections, '[]'::jsonb)), 0) > 0 then
    insert into public.song_sections (song_id, section_type, section_label, position, content)
    select
      p_song_id,
      coalesce(nullif(section_item->>'section_type', ''), 'verse'),
      nullif(section_item->>'section_label', ''),
      coalesce((section_item->>'position')::integer, row_number() over ())::integer,
      section_item->>'content'
    from jsonb_array_elements(p_sections) section_item
    where nullif(trim(coalesce(section_item->>'content', '')), '') is not null;
  end if;

  if not exists (select 1 from public.song_sections where song_id = p_song_id) then
    insert into public.song_sections (song_id, section_type, section_label, position, content)
    values (p_song_id, 'verse', 'Strofa 1', 1, p_lyrics_text);
  end if;

  insert into public.song_files (collection_id, song_id, file_name, file_type, storage_path, import_status, parsed_text, parser_notes)
  values (p_collection_id, p_song_id, coalesce(nullif(p_file_name, ''), v_source_title || '.txt'), v_file_type, p_storage_path, 'needs_review', p_lyrics_text, p_parser_notes)
  returning id into v_file_id;

  select id into v_source_id
  from public.song_sources
  where collection_id = p_collection_id
    and source_title = v_source_title
    and (song_number is not distinct from nullif(p_song_number, ''))
  limit 1;

  if v_source_id is not null then
    update public.song_sources
    set song_id = p_song_id,
        source_file_id = v_file_id
    where id = v_source_id;

    delete from public.song_sources
    where song_id = p_song_id
      and collection_id = p_collection_id
      and id <> v_source_id;
  else
    select id into v_source_id
    from public.song_sources
    where song_id = p_song_id
      and collection_id = p_collection_id
    limit 1;

    if v_source_id is not null then
      update public.song_sources
      set song_number = nullif(p_song_number, ''),
          source_title = v_source_title,
          source_file_id = v_file_id
      where id = v_source_id;
    else
      insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
      values (p_song_id, p_collection_id, nullif(p_song_number, ''), v_source_title, v_file_id);
    end if;
  end if;

  return p_song_id;
end;
$$;

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
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiuni pentru sincronizare externă.' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Titlul cântării externe este obligatoriu.';
  end if;

  if nullif(trim(coalesce(p_lyrics_text, '')), '') is null then
    raise exception 'Versurile cântării externe sunt obligatorii.';
  end if;

  select * into v_ref
  from public.external_song_refs
  where external_source_id = p_external_source_id
    and external_id = p_external_id
  limit 1;

  if v_ref.id is not null and v_ref.song_id is not null and v_ref.content_hash = p_content_hash and not p_overwrite then
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

grant execute on function public.import_song_with_sections(uuid, text, text, text, jsonb, text, text, text, text, integer, text, text, text) to authenticated;
grant execute on function public.overwrite_song_with_sections(uuid, uuid, text, text, text, jsonb, text, text, text, text, integer, text, text, text) to authenticated;
grant execute on function public.upsert_external_song_title_lyrics(uuid, uuid, text, text, text, text, jsonb, text, boolean) to authenticated;

notify pgrst, 'reload schema';

create or replace function public.import_sync_integrity_report()
returns table(check_name text, issue_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select 'song_files_without_song'::text, count(*)::integer from public.song_files where song_id is null
  union all
  select 'song_files_without_collection'::text, count(*)::integer from public.song_files where collection_id is null
  union all
  select 'imported_songs_without_sections'::text, count(distinct sf.song_id)::integer
    from public.song_files sf
    left join public.song_sections ss on ss.song_id = sf.song_id
    where sf.song_id is not null and ss.id is null
  union all
  select 'imported_songs_without_source'::text, count(distinct sf.song_id)::integer
    from public.song_files sf
    left join public.song_sources src on src.song_id = sf.song_id
    where sf.song_id is not null and src.id is null
  union all
  select 'external_refs_without_song'::text, count(*)::integer from public.external_song_refs where song_id is null
  union all
  select 'external_songs_without_sections'::text, count(distinct er.song_id)::integer
    from public.external_song_refs er
    left join public.song_sections ss on ss.song_id = er.song_id
    where er.song_id is not null and ss.id is null
  union all
  select 'external_songs_without_source'::text, count(distinct er.song_id)::integer
    from public.external_song_refs er
    left join public.song_sources src on src.song_id = er.song_id and src.collection_id = er.collection_id
    where er.song_id is not null and src.id is null
  union all
  select 'stale_running_sync_runs'::text, count(*)::integer
    from public.external_sync_runs
    where status = 'running' and started_at < now() - interval '2 hours';
$$;

grant execute on function public.import_sync_integrity_report() to authenticated;

notify pgrst, 'reload schema';


-- FILE: 026_v32_public_share_contributions.sql
-- v32: Propuneri externe prin link public de share

create table if not exists public.public_meeting_contributions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  share_link_id uuid references public.meeting_share_links(id) on delete set null,
  contribution_type text not null default 'song' check (contribution_type in ('song','text','prayer','encouragement','message','break')),
  song_id uuid references public.songs(id) on delete set null,
  custom_title text,
  custom_text text,
  is_backup boolean not null default false,
  contributor_name text,
  notes text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint public_meeting_contribution_has_content check (
    (song_id is not null) or (coalesce(custom_title, '') <> '') or (coalesce(custom_text, '') <> '')
  )
);

create index if not exists public_meeting_contributions_meeting_idx on public.public_meeting_contributions(meeting_id, status, created_at);
create index if not exists public_meeting_contributions_song_idx on public.public_meeting_contributions(song_id);

alter table public.public_meeting_contributions enable row level security;

DO $$ BEGIN
  CREATE POLICY "public_contributions_read_auth" ON public.public_meeting_contributions
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "public_contributions_manage_editors" ON public.public_meeting_contributions
  FOR ALL TO authenticated USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
EXCEPTION WHEN duplicate_object THEN null; END $$;

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
    'items', coalesce(jsonb_agg(
      distinct jsonb_build_object(
        'position', mi.position,
        'item_type', mi.item_type,
        'is_backup', mi.is_backup,
        'custom_title', mi.custom_title,
        'custom_text', mi.custom_text,
        'selected_key', mi.selected_key,
        'selected_bpm', mi.selected_bpm,
        'notes', mi.notes,
        'song', case when s.id is null then null else jsonb_build_object(
          'title', s.title,
          'lyrics_text', s.lyrics_text,
          'default_key', s.default_key,
          'bpm', s.bpm,
          'structure', s.structure
        ) end
      )
    ) filter (where mi.id is not null), '[]'::jsonb),
    'contributions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'created_at', c.created_at,
          'contribution_type', c.contribution_type,
          'status', c.status,
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
            'structure', cs.structure
          ) end
        ) order by c.created_at asc
      )
      from public.public_meeting_contributions c
      left join public.songs cs on cs.id = c.song_id
      where c.meeting_id = m.id
        and c.status = 'pending'
    ), '[]'::jsonb)
  )
  from public.meeting_share_links l
  join public.meetings m on m.id = l.meeting_id
  left join public.meeting_items mi on mi.meeting_id = m.id
  left join public.songs s on s.id = mi.song_id
  where l.public_slug = p_public_slug
    and l.is_active = true
    and (l.expires_at is null or l.expires_at > now())
  group by m.id, m.title, m.meeting_type, m.meeting_date, m.notes;
$$;

grant execute on function public.get_shared_meeting(text) to anon, authenticated;

create or replace function public.public_search_songs_for_share(
  p_public_slug text,
  search_query text,
  result_limit integer default 20
)
returns table (
  song_id uuid,
  title text,
  default_key text,
  bpm integer,
  matched_source text
)
language sql
stable
security definer
set search_path = public
as $$
  with active_link as (
    select l.id
    from public.meeting_share_links l
    where l.public_slug = p_public_slug
      and l.is_active = true
      and (l.expires_at is null or l.expires_at > now())
    limit 1
  ), q as (
    select trim(coalesce(search_query, '')) as term
  )
  select r.song_id, r.title, r.default_key, r.bpm, r.matched_source
  from active_link
  cross join q
  cross join lateral public.search_songs(q.term, least(greatest(result_limit, 1), 30)) r
  where length(q.term) >= 2;
$$;

grant execute on function public.public_search_songs_for_share(text, text, integer) to anon, authenticated;

create or replace function public.add_public_meeting_contribution(
  p_public_slug text,
  p_contribution_type text default 'song',
  p_song_id uuid default null,
  p_custom_title text default null,
  p_custom_text text default null,
  p_is_backup boolean default false,
  p_contributor_name text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
  v_id uuid;
begin
  select l.id as share_link_id, l.meeting_id
  into v_link
  from public.meeting_share_links l
  where l.public_slug = p_public_slug
    and l.is_active = true
    and (l.expires_at is null or l.expires_at > now())
  limit 1;

  if v_link.share_link_id is null then
    raise exception 'Linkul public nu este activ.';
  end if;

  p_contribution_type := coalesce(nullif(p_contribution_type, ''), 'song');
  if p_contribution_type not in ('song','text','prayer','encouragement','message','break') then
    raise exception 'Tip de contribuție invalid.';
  end if;

  if p_song_id is null and coalesce(trim(p_custom_title), '') = '' and coalesce(trim(p_custom_text), '') = '' then
    raise exception 'Adaugă o cântare sau completează un text.';
  end if;

  if p_song_id is not null and not exists (select 1 from public.songs s where s.id = p_song_id and s.is_active = true) then
    raise exception 'Cântarea selectată nu există.';
  end if;

  insert into public.public_meeting_contributions (
    meeting_id,
    share_link_id,
    contribution_type,
    song_id,
    custom_title,
    custom_text,
    is_backup,
    contributor_name,
    notes,
    status
  ) values (
    v_link.meeting_id,
    v_link.share_link_id,
    p_contribution_type,
    p_song_id,
    nullif(left(trim(coalesce(p_custom_title, '')), 180), ''),
    nullif(left(trim(coalesce(p_custom_text, '')), 4000), ''),
    coalesce(p_is_backup, false),
    nullif(left(trim(coalesce(p_contributor_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_notes, '')), 1000), ''),
    'pending'
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_public_meeting_contribution(text, text, uuid, text, text, boolean, text, text) to anon, authenticated;

create or replace function public.accept_public_meeting_contribution(p_contribution_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c record;
  v_position integer;
  v_item_id uuid;
  v_notes text;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să accepți propuneri.';
  end if;

  select * into v_c
  from public.public_meeting_contributions
  where id = p_contribution_id
    and status = 'pending'
  for update;

  if v_c.id is null then
    raise exception 'Propunerea nu există sau a fost deja procesată.';
  end if;

  select coalesce(max(position), case when v_c.is_backup then 900 else 0 end) + 1
  into v_position
  from public.meeting_items
  where meeting_id = v_c.meeting_id
    and is_backup = v_c.is_backup;

  v_notes := concat_ws(E'\n',
    nullif(v_c.notes, ''),
    'Adăugată din link public' || case when v_c.contributor_name is not null then ' de ' || v_c.contributor_name else '' end
  );

  insert into public.meeting_items (
    meeting_id,
    position,
    item_type,
    song_id,
    custom_title,
    custom_text,
    is_backup,
    notes
  ) values (
    v_c.meeting_id,
    v_position,
    v_c.contribution_type,
    v_c.song_id,
    v_c.custom_title,
    v_c.custom_text,
    v_c.is_backup,
    nullif(v_notes, '')
  ) returning id into v_item_id;

  update public.public_meeting_contributions
  set status = 'accepted', reviewed_at = now(), reviewed_by = auth.uid()
  where id = v_c.id;

  return v_item_id;
end;
$$;

grant execute on function public.accept_public_meeting_contribution(uuid) to authenticated;

create or replace function public.reject_public_meeting_contribution(p_contribution_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să respingi propuneri.';
  end if;

  update public.public_meeting_contributions
  set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_contribution_id
    and status = 'pending';

  if not found then
    raise exception 'Propunerea nu există sau a fost deja procesată.';
  end if;

  return true;
end;
$$;

grant execute on function public.reject_public_meeting_contribution(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Re-definire mai stabilă: agregările sunt făcute în subquery-uri separate ca să evităm duplicatele din join-uri.
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
          'song', case when s.id is null then null else jsonb_build_object(
            'title', s.title,
            'lyrics_text', s.lyrics_text,
            'default_key', s.default_key,
            'bpm', s.bpm,
            'structure', s.structure
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
          'contribution_type', c.contribution_type,
          'status', c.status,
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
            'structure', cs.structure
          ) end
        ) order by c.created_at asc
      )
      from public.public_meeting_contributions c
      left join public.songs cs on cs.id = c.song_id
      where c.meeting_id = m.id
        and c.status = 'pending'
    ), '[]'::jsonb)
  )
  from public.meeting_share_links l
  join public.meetings m on m.id = l.meeting_id
  where l.public_slug = p_public_slug
    and l.is_active = true
    and (l.expires_at is null or l.expires_at > now())
  limit 1;
$$;

notify pgrst, 'reload schema';


-- FILE: 027_v33_public_share_search_accept_fix.sql
-- v33: Fix acceptare propuneri publice + cautare publica dupa numar/text cu/fara diacritice.

-- v42 installer compatibility: v32 returned fewer columns; PostgreSQL requires
-- dropping the old signature before changing a RETURNS TABLE definition.
drop function if exists public.public_search_songs_for_share(text,text,integer);

create or replace function public.public_search_songs_for_share(
  p_public_slug text,
  search_query text,
  result_limit integer default 20
)
returns table (
  song_id uuid,
  title text,
  default_key text,
  bpm integer,
  matched_source text,
  lyrics_text text
)
language sql
stable
security definer
set search_path = public
as $$
  with active_link as (
    select l.id
    from public.meeting_share_links l
    where l.public_slug = p_public_slug
      and l.is_active = true
      and (l.expires_at is null or l.expires_at > now())
    limit 1
  ), q as (
    select
      trim(coalesce(search_query, '')) as raw_term,
      lower(public.unaccent(trim(coalesce(search_query, '')))) as term,
      regexp_replace(lower(public.unaccent(trim(coalesce(search_query, '')))), '^nr\.?\s*', '', 'i') as number_term
  ), matches as (
    select
      s.id as song_id,
      s.title,
      s.default_key,
      s.bpm,
      s.lyrics_text,
      string_agg(distinct coalesce(sc.short_code || ' nr. ' || ss.song_number, sc.short_code, ss.source_title), ', ') as matched_source,
      greatest(
        case when lower(public.unaccent(s.title)) = q.term then 1.0 else 0.0 end,
        case when lower(public.unaccent(s.title)) like '%' || q.term || '%' then 0.85 else 0.0 end,
        case when s.search_text like '%' || q.term || '%' then 0.75 else 0.0 end,
        coalesce(similarity(s.search_text, q.term), 0),
        case when exists (
          select 1
          from public.song_sources ss2
          where ss2.song_id = s.id
            and (
              lower(public.unaccent(coalesce(ss2.song_number, ''))) like '%' || q.number_term || '%'
              or lower(public.unaccent(coalesce(ss2.source_title, ''))) like '%' || q.term || '%'
            )
        ) then 0.95 else 0.0 end
      )::real as rank
    from active_link
    cross join q
    join public.songs s on s.is_active = true
    left join public.song_sources ss on ss.song_id = s.id
    left join public.song_collections sc on sc.id = ss.collection_id
    where length(q.term) >= 2
      and (
        s.search_text like '%' || q.term || '%'
        or lower(public.unaccent(s.title)) like '%' || q.term || '%'
        or exists (
          select 1
          from public.song_sources ss3
          where ss3.song_id = s.id
            and (
              lower(public.unaccent(coalesce(ss3.song_number, ''))) like '%' || q.number_term || '%'
              or lower(public.unaccent(coalesce(ss3.source_title, ''))) like '%' || q.term || '%'
            )
        )
      )
    group by s.id, s.title, s.default_key, s.bpm, s.lyrics_text, s.search_text, q.term, q.number_term
  )
  select m.song_id, m.title, m.default_key, m.bpm, m.matched_source, m.lyrics_text
  from matches m
  order by m.rank desc, m.title asc
  limit least(greatest(result_limit, 1), 30);
$$;

grant execute on function public.public_search_songs_for_share(text, text, integer) to anon, authenticated;

create or replace function public.accept_public_meeting_contribution(p_contribution_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c record;
  v_position integer;
  v_item_id uuid;
  v_notes text;
  v_item_type public.meeting_item_type;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să accepți propuneri.';
  end if;

  select * into v_c
  from public.public_meeting_contributions
  where id = p_contribution_id
    and status = 'pending'
  for update;

  if v_c.id is null then
    raise exception 'Propunerea nu există sau a fost deja procesată.';
  end if;

  v_item_type := case
    when v_c.song_id is not null then 'song'::public.meeting_item_type
    when v_c.contribution_type in ('text','prayer','encouragement','message','break') then v_c.contribution_type::public.meeting_item_type
    else 'text'::public.meeting_item_type
  end;

  select coalesce(max(position), case when v_c.is_backup then 900 else 0 end) + 1
  into v_position
  from public.meeting_items
  where meeting_id = v_c.meeting_id
    and is_backup = v_c.is_backup;

  v_notes := concat_ws(E'\n',
    nullif(v_c.notes, ''),
    'Adăugată din link public' || case when v_c.contributor_name is not null then ' de ' || v_c.contributor_name else '' end
  );

  insert into public.meeting_items (
    meeting_id,
    position,
    item_type,
    song_id,
    custom_title,
    custom_text,
    is_backup,
    notes
  ) values (
    v_c.meeting_id,
    v_position,
    v_item_type,
    v_c.song_id,
    v_c.custom_title,
    v_c.custom_text,
    v_c.is_backup,
    nullif(v_notes, '')
  ) returning id into v_item_id;

  update public.public_meeting_contributions
  set status = 'accepted', reviewed_at = now(), reviewed_by = auth.uid()
  where id = v_c.id;

  return v_item_id;
end;
$$;

grant execute on function public.accept_public_meeting_contribution(uuid) to authenticated;

notify pgrst, 'reload schema';

grant execute on function public.public_search_songs_for_share(text,text,integer) to anon,authenticated;


-- FILE: 028_v34_meeting_program_ui_recent_usage.sql
-- v34: recent usage scoped to another meeting, plus schema cache reload.

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
security definer
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

grant execute on function public.get_song_recent_usage_excluding_meeting(integer, uuid) to authenticated;

notify pgrst, 'reload schema';


-- FILE: 029_v35_public_compact_program_source_summary.sql
-- v35: Program public compact + număr/sursă în pagina publică.
-- Nu schimbă schema; redefinește get_shared_meeting ca să includă source_summary pentru cântări.

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
          'contribution_type', c.contribution_type,
          'status', c.status,
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
    ), '[]'::jsonb)
  )
  from public.meeting_share_links l
  join public.meetings m on m.id = l.meeting_id
  where l.public_slug = p_public_slug
    and l.is_active = true
    and (l.expires_at is null or l.expires_at > now())
  limit 1;
$$;

grant execute on function public.get_shared_meeting(text) to anon, authenticated;
notify pgrst, 'reload schema';


-- FILE: 030_no_sql_needed_v36.sql
-- v36: nu este nevoie de SQL nou.
notify pgrst, 'reload schema';


-- FILE: 031_no_sql_needed_v37.sql
-- v37: no SQL needed. Importul continuă peste fișierele cu eroare și raportează eșecurile în wizard.


-- FILE: 032_v38_public_share_polish.sql
-- v38: Polish pentru share public editabil
-- - poziție propusă de user extern
-- - istoric contribuții
-- - acceptare la poziția propusă, cu reordonare sigură

alter table public.public_meeting_contributions
  add column if not exists proposed_position integer;

create index if not exists public_meeting_contributions_history_idx
  on public.public_meeting_contributions(meeting_id, status, reviewed_at desc, created_at desc);

create or replace function public.add_public_meeting_contribution(
  p_public_slug text,
  p_contribution_type text default 'song',
  p_song_id uuid default null,
  p_custom_title text default null,
  p_custom_text text default null,
  p_is_backup boolean default false,
  p_proposed_position integer default null,
  p_contributor_name text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
  v_id uuid;
  v_position integer;
begin
  select l.id as share_link_id, l.meeting_id
  into v_link
  from public.meeting_share_links l
  where l.public_slug = p_public_slug
    and l.is_active = true
    and (l.expires_at is null or l.expires_at > now())
  limit 1;

  if v_link.share_link_id is null then
    raise exception 'Linkul public nu este activ.';
  end if;

  p_contribution_type := coalesce(nullif(p_contribution_type, ''), 'song');
  if p_contribution_type not in ('song','text','prayer','encouragement','message','break') then
    raise exception 'Tip de contribuție invalid.';
  end if;

  if p_song_id is null and coalesce(trim(p_custom_title), '') = '' and coalesce(trim(p_custom_text), '') = '' then
    raise exception 'Adaugă o cântare sau completează un text.';
  end if;

  if p_song_id is not null and not exists (select 1 from public.songs s where s.id = p_song_id and s.is_active = true) then
    raise exception 'Cântarea selectată nu există.';
  end if;

  if p_proposed_position is not null then
    v_position := greatest(1, least(p_proposed_position, 999));
  else
    v_position := null;
  end if;

  insert into public.public_meeting_contributions (
    meeting_id,
    share_link_id,
    contribution_type,
    song_id,
    custom_title,
    custom_text,
    is_backup,
    proposed_position,
    contributor_name,
    notes,
    status
  ) values (
    v_link.meeting_id,
    v_link.share_link_id,
    p_contribution_type,
    p_song_id,
    nullif(left(trim(coalesce(p_custom_title, '')), 180), ''),
    nullif(left(trim(coalesce(p_custom_text, '')), 4000), ''),
    coalesce(p_is_backup, false),
    v_position,
    nullif(left(trim(coalesce(p_contributor_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_notes, '')), 1000), ''),
    'pending'
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_public_meeting_contribution(text, text, uuid, text, text, boolean, integer, text, text) to anon, authenticated;

create or replace function public.accept_public_meeting_contribution(p_contribution_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c record;
  v_position integer;
  v_max_position integer;
  v_base integer;
  v_item_id uuid;
  v_notes text;
  v_item_type public.meeting_item_type;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să accepți propuneri.';
  end if;

  select * into v_c
  from public.public_meeting_contributions
  where id = p_contribution_id
    and status = 'pending'
  for update;

  if v_c.id is null then
    raise exception 'Propunerea nu există sau a fost deja procesată.';
  end if;

  v_item_type := case
    when v_c.song_id is not null then 'song'::public.meeting_item_type
    when v_c.contribution_type in ('text','prayer','encouragement','message','break') then v_c.contribution_type::public.meeting_item_type
    else 'text'::public.meeting_item_type
  end;

  v_base := case when v_c.is_backup then 900 else 0 end;

  select coalesce(max(position), v_base)
  into v_max_position
  from public.meeting_items
  where meeting_id = v_c.meeting_id
    and is_backup = v_c.is_backup;

  if v_c.proposed_position is null then
    v_position := v_max_position + 1;
  else
    v_position := v_base + greatest(1, least(v_c.proposed_position, greatest(v_max_position - v_base + 1, 1)));
  end if;

  -- Facem loc pentru poziția propusă fără să riscăm coliziuni pe unique(meeting_id, position).
  update public.meeting_items
  set position = position + 10000
  where meeting_id = v_c.meeting_id
    and is_backup = v_c.is_backup
    and position >= v_position;

  update public.meeting_items
  set position = position - 9999
  where meeting_id = v_c.meeting_id
    and is_backup = v_c.is_backup
    and position >= v_position + 10000;

  v_notes := concat_ws(E'\n',
    nullif(v_c.notes, ''),
    'Adăugată din link public' || case when v_c.contributor_name is not null then ' de ' || v_c.contributor_name else '' end
  );

  insert into public.meeting_items (
    meeting_id,
    position,
    item_type,
    song_id,
    custom_title,
    custom_text,
    is_backup,
    notes
  ) values (
    v_c.meeting_id,
    v_position,
    v_item_type,
    v_c.song_id,
    v_c.custom_title,
    v_c.custom_text,
    v_c.is_backup,
    nullif(v_notes, '')
  ) returning id into v_item_id;

  update public.public_meeting_contributions
  set status = 'accepted', reviewed_at = now(), reviewed_by = auth.uid()
  where id = v_c.id;

  return v_item_id;
end;
$$;

grant execute on function public.accept_public_meeting_contribution(uuid) to authenticated;

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

grant execute on function public.get_shared_meeting(text) to anon, authenticated;
notify pgrst, 'reload schema';


-- FILE: 033_no_sql_needed_v39.sql
-- v39 UI polish only. No database changes required.
NOTIFY pgrst, 'reload schema';


-- FILE: 034_v40_specific_bible_suggestions_cleanup_titles.sql
-- v40: curăță titlul/numărul cântării din song_sections și reconstruiește lyrics_text.
-- Rulează o dată după update ca să cureți importurile vechi.

create or replace function public.normalize_song_line_for_cleanup(value text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        translate(lower(coalesce(value, '')), 'ăâîșşțţ', 'aaisstt'),
        '^[[:space:][:digit:].\-–—_#:/()\[\]]+', '', 'g'
      ),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

create or replace function public.cleanup_repeated_song_titles_in_sections()
returns table(updated_songs integer, updated_sections integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  section_record record;
  cleaned_content text;
  changed_sections integer := 0;
  changed_songs integer := 0;
begin
  create temp table if not exists _songs_to_rebuild(song_id uuid primary key) on commit drop;
  truncate table _songs_to_rebuild;

  for section_record in
    select
      ss.id,
      ss.song_id,
      ss.content,
      s.title,
      coalesce(array_agg(src.song_number) filter (where src.song_number is not null), '{}') as numbers
    from public.song_sections ss
    join public.songs s on s.id = ss.song_id
    left join public.song_sources src on src.song_id = s.id
    group by ss.id, ss.song_id, ss.content, s.title
  loop
    with lines as (
      select line, ord
      from regexp_split_to_table(coalesce(section_record.content, ''), E'\r?\n') with ordinality as t(line, ord)
    ), cleaned as (
      select line, ord
      from lines
      where not (
        public.normalize_song_line_for_cleanup(line) <> ''
        and (
          replace(public.normalize_song_line_for_cleanup(line), ' ', '') = replace(public.normalize_song_line_for_cleanup(section_record.title), ' ', '')
          or exists (
            select 1
            from unnest(section_record.numbers) n
            where replace(public.normalize_song_line_for_cleanup(line), ' ', '') in (
              replace(public.normalize_song_line_for_cleanup(n), ' ', ''),
              replace(public.normalize_song_line_for_cleanup(n || ' ' || section_record.title), ' ', ''),
              replace(public.normalize_song_line_for_cleanup(section_record.title || ' ' || n), ' ', '')
            )
          )
        )
      )
    )
    select trim(regexp_replace(string_agg(line, E'\n' order by ord), E'\n{3,}', E'\n\n', 'g'))
    into cleaned_content
    from cleaned;

    cleaned_content := coalesce(cleaned_content, '');

    if cleaned_content is distinct from coalesce(section_record.content, '') then
      update public.song_sections
      set content = cleaned_content
      where id = section_record.id;
      changed_sections := changed_sections + 1;
      insert into _songs_to_rebuild(song_id) values (section_record.song_id)
      on conflict do nothing;
    end if;
  end loop;

  delete from public.song_sections where trim(coalesce(content, '')) = '';

  for section_record in select song_id from _songs_to_rebuild loop
    update public.songs s
    set lyrics_text = coalesce((
      select string_agg(trim(ss.content), E'\n\n' order by ss.position)
      from public.song_sections ss
      where ss.song_id = section_record.song_id and trim(coalesce(ss.content, '')) <> ''
    ), s.lyrics_text)
    where s.id = section_record.song_id;
    changed_songs := changed_songs + 1;
  end loop;

  updated_songs := changed_songs;
  updated_sections := changed_sections;
  return next;
end;
$$;

select * from public.cleanup_repeated_song_titles_in_sections();
notify pgrst, 'reload schema';


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
begin;

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


-- FILE: 037_v43_link_import.sql
-- v43: Import by reviewed link. Existing songs, refs and collections are retained.
begin;
create table if not exists public.song_link_imports (
  source_key text primary key,
  source_url text not null,
  song_id uuid not null references public.songs(id) on delete cascade,
  imported_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.song_link_imports enable row level security;
drop policy if exists link_imports_active_read on public.song_link_imports;
create policy link_imports_active_read on public.song_link_imports for select to authenticated using(public.current_user_role() is not null);
grant select on public.song_link_imports to authenticated;
grant select,insert,update,delete on public.song_link_imports to service_role;
revoke insert,update,delete on public.song_link_imports from public,anon,authenticated;

-- Pending legacy work must not import more songs after switching workflows.
update public.external_sync_runs set status='cancelled',finished_at=now(),lease_token=null,lease_until=null,error_message='Sincronizare suspendată: importul se face acum din link, cu preview.'
where status in ('queued','running');

create or replace function public.find_link_song_matches(p_source_key text,p_title text)
returns jsonb language sql stable security invoker set search_path=public as $$
select coalesce(jsonb_agg(jsonb_build_object('songId',x.id,'title',x.title,'sourceMatch',x.source_match) order by x.source_match desc,x.title),'[]'::jsonb)
from (
  select s.id,s.title,
    (exists(select 1 from public.song_link_imports l where l.song_id=s.id and l.source_key=p_source_key)
    or exists(select 1 from public.external_song_refs r where r.song_id=s.id and 'resursecrestine:'||substring(r.external_url from '/cantece/([0-9]+)')=p_source_key)) as source_match
  from public.songs s where s.is_active and (
    public.normalize_song_title_for_duplicates(s.title)=public.normalize_song_title_for_duplicates(p_title)
    or exists(select 1 from public.song_link_imports l where l.song_id=s.id and l.source_key=p_source_key)
    or exists(select 1 from public.external_song_refs r where r.song_id=s.id and 'resursecrestine:'||substring(r.external_url from '/cantece/([0-9]+)')=p_source_key)
  ) order by source_match desc,s.title,s.id limit 20
) x;
$$;

create or replace function public.import_reviewed_song_link(
  p_source_key text,p_url text,p_title text,p_lyrics text,p_sections jsonb,
  p_collection_ids uuid[],p_existing_song_id uuid default null,p_notes text default null,
  p_structure text default null,p_song_number text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_song uuid; v_mapped uuid; v_collection uuid; v_file uuid; v_new boolean:=false; v_collections uuid[]; v_linked integer:=0;
begin
  if not public.can_edit_content() then raise exception 'Nu ai permisiunea pentru import.' using errcode='42501'; end if;
  if p_source_key !~ '^resursecrestine:[0-9]+$' or p_source_key is null
    or p_url !~ '^https://www\.resursecrestine\.ro/cantece/[0-9]+/[^/?#]+$'
    or p_url is null or p_source_key <> 'resursecrestine:'||substring(p_url from '/cantece/([0-9]+)') then raise exception 'Link invalid.'; end if;
  if length(trim(coalesce(p_title,''))) not between 1 and 300 or length(trim(coalesce(p_lyrics,''))) not between 20 and 100000 then raise exception 'Verifică titlul și versurile.'; end if;
  if jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections) not between 1 and 200 then raise exception 'Secțiuni invalide.'; end if;
  select array_agg(distinct c) into v_collections from unnest(p_collection_ids) c where c is not null;
  if coalesce(cardinality(v_collections),0) not between 1 and 20 then raise exception 'Alege între 1 și 20 de colecții.'; end if;
  if (select count(*) from public.song_collections where id=any(v_collections) and is_active) <> cardinality(v_collections) then raise exception 'Una dintre colecții nu mai este activă.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_source_key,43));
  select song_id into v_mapped from public.song_link_imports where source_key=p_source_key;
  if v_mapped is not null and p_existing_song_id is not null and v_mapped<>p_existing_song_id then raise exception 'Linkul este deja asociat altei cântări. Reîncarcă preview-ul.'; end if;
  v_song:=coalesce(v_mapped,p_existing_song_id);
  if v_song is null then
    select r.song_id into v_song from public.external_song_refs r join public.songs s on s.id=r.song_id
    where s.is_active and 'resursecrestine:'||substring(r.external_url from '/cantece/([0-9]+)')=p_source_key order by r.created_at limit 1;
  end if;
  if v_song is null then
    v_song:=public.import_song_with_sections(v_collections[1],trim(p_title),nullif(trim(p_song_number),''),p_lyrics,p_sections,
      trim(p_title)||'.url','other','Import din link, verificat în preview. Sursa: '||p_url,null,null,p_structure,p_notes,null);
    v_new:=true;
    select id into v_file from public.song_files where song_id=v_song order by created_at desc limit 1;
  else
    perform id from public.songs where id=v_song for update;
    if not exists(select 1 from public.songs where id=v_song and is_active) then raise exception 'Cântarea existentă nu mai este activă.'; end if;
  end if;
  foreach v_collection in array v_collections loop
    if not exists(select 1 from public.song_sources where song_id=v_song and collection_id=v_collection) then
      insert into public.song_sources(song_id,collection_id,song_number,source_title,source_file_id)
      values(v_song,v_collection,nullif(trim(p_song_number),''),(select title from public.songs where id=v_song),v_file);
      v_linked:=v_linked+1;
    end if;
  end loop;
  insert into public.song_link_imports(source_key,source_url,song_id,imported_by) values(p_source_key,p_url,v_song,auth.uid())
  on conflict(source_key) do nothing;
  return jsonb_build_object('songId',v_song,'created',v_new,'collectionsAdded',v_linked+case when v_new then 1 else 0 end);
end $$;
revoke execute on function public.find_link_song_matches(text,text) from public,anon;
revoke execute on function public.import_reviewed_song_link(text,text,text,text,jsonb,uuid[],uuid,text,text,text) from public,anon;
grant execute on function public.find_link_song_matches(text,text) to authenticated;
grant execute on function public.import_reviewed_song_link(text,text,text,text,jsonb,uuid[],uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;


-- FILE: 038_v44_library_search.sql
-- v44: one library for search + collection/category/key filters.
-- Read-only RPC, with the same RLS and active-profile guard as v42.
begin;
create or replace function public.list_song_library_v44(
  p_collection uuid default null, p_category uuid default null, p_number text default null,
  p_status text default null, p_key text default null, p_sort text default 'title_asc',
  p_page integer default 1, p_page_size integer default 50, p_query text default null
) returns jsonb language sql stable security invoker set search_path = public as $$
with filtered as materialized (
  select s.id,s.title,s.default_key,s.bpm,s.structure,s.created_at,
    (select min(nullif(regexp_replace(src.song_number,'[^0-9]','','g'),'')::numeric)
       from public.song_sources src where src.song_id=s.id
       and (p_collection is null or src.collection_id=p_collection)) as source_number
  from public.songs s
  where s.is_active
    and (nullif(trim(p_query),'') is null
      or s.search_vector @@ plainto_tsquery('simple',public.unaccent(p_query))
      or s.search_text ilike '%'||lower(public.unaccent(p_query))||'%'
      or exists(select 1 from public.song_sources ss where ss.song_id=s.id and
        (ss.song_number ilike '%'||p_query||'%' or lower(public.unaccent(coalesce(ss.source_title,''))) ilike '%'||lower(public.unaccent(p_query))||'%')))
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
revoke execute on function public.list_song_library_v44(uuid,uuid,text,text,text,text,integer,integer,text) from public,anon;
grant execute on function public.list_song_library_v44(uuid,uuid,text,text,text,text,integer,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;


-- FILE: 039_v45_program_fixes.sql
begin;
alter table public.meetings add column if not exists principal_responsible text;
alter table public.meetings add column if not exists secondary_responsibles text[] not null default '{}';
alter table public.meetings drop constraint if exists meeting_responsibles_length;
alter table public.meetings add constraint meeting_responsibles_length check (
  char_length(coalesce(principal_responsible,'')) <= 120 and cardinality(secondary_responsibles) <= 20
);

-- One atomic move for arrows, drag/drop, and transfer between lists.
-- Serialize per meeting; validate destination before writing any position.
create or replace function public.place_meeting_item_v45(
  p_meeting_id uuid, p_item_id uuid, p_is_backup boolean, p_before_id uuid default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare
  v_ids uuid[]; v_main uuid[]; v_backup uuid[]; v_target uuid[] := '{}';
  v_id uuid; v_index integer; v_min integer;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  perform 1 from public.meetings where id=p_meeting_id for update;
  if not found then raise exception 'Programul nu există.'; end if;
  if p_is_backup is null or not exists(select 1 from public.meeting_items where id=p_item_id and meeting_id=p_meeting_id) then
    raise exception 'Elementul nu există în acest program.';
  end if;
  if p_before_id=p_item_id then return true; end if;
  if p_before_id is not null and not exists(select 1 from public.meeting_items where id=p_before_id and meeting_id=p_meeting_id and is_backup=p_is_backup) then
    raise exception 'Poziția de destinație s-a schimbat. Încearcă din nou.';
  end if;
  select coalesce(array_agg(id order by position,id) filter(where not is_backup and id<>p_item_id),'{}'),
         coalesce(array_agg(id order by position,id) filter(where is_backup and id<>p_item_id),'{}'),
         least(coalesce(min(position),0),0)-count(*)::integer-1
    into v_main,v_backup,v_min from public.meeting_items where meeting_id=p_meeting_id;
  foreach v_id in array (case when p_is_backup then v_backup else v_main end) loop
    if v_id=p_before_id then v_target:=array_append(v_target,p_item_id); end if;
    v_target:=array_append(v_target,v_id);
  end loop;
  if p_before_id is null then v_target:=array_append(v_target,p_item_id); end if;
  if p_is_backup then v_backup:=v_target; else v_main:=v_target; end if;
  v_ids:=v_main||v_backup;
  v_index:=0;
  foreach v_id in array v_ids loop
    update public.meeting_items set position=v_min+v_index where id=v_id and meeting_id=p_meeting_id;
    v_index:=v_index+1;
  end loop;
  update public.meeting_items set is_backup=p_is_backup where id=p_item_id and meeting_id=p_meeting_id;
  v_index:=1;
  foreach v_id in array v_ids loop
    update public.meeting_items set position=v_index where id=v_id and meeting_id=p_meeting_id;
    v_index:=v_index+1;
  end loop;
  return true;
end $$;
revoke all on function public.place_meeting_item_v45(uuid,uuid,boolean,uuid) from public,anon;
grant execute on function public.place_meeting_item_v45(uuid,uuid,boolean,uuid) to authenticated;

-- Position allocation follows group membership, never a magic numeric threshold.
create or replace function public.add_song_to_meeting(
  p_meeting_id uuid,
  p_song_id uuid,
  p_is_backup boolean default false,
  p_selected_key text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_position integer;
  v_song_key text;
  v_song_bpm integer;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  if not exists (select 1 from public.meetings where id = p_meeting_id) then
    raise exception 'Programul nu există.';
  end if;

  select default_key, bpm into v_song_key, v_song_bpm
  from public.songs
  where id = p_song_id and is_active = true;

  perform 1 from public.meetings where id=p_meeting_id for update;
  select coalesce(max(position),0)+1 into v_position from public.meeting_items where meeting_id=p_meeting_id;

  insert into public.meeting_items (
    meeting_id,
    position,
    item_type,
    song_id,
    selected_key,
    selected_bpm,
    is_backup,
    notes
  )
  values (
    p_meeting_id,
    v_position,
    'song',
    p_song_id,
    coalesce(p_selected_key, v_song_key),
    v_song_bpm,
    p_is_backup,
    p_notes
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Position allocation follows group membership, never a magic numeric threshold.
create or replace function public.add_text_to_meeting(
  p_meeting_id uuid,
  p_item_type text default 'text',
  p_custom_title text default null,
  p_custom_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_position integer;
  v_item_type public.meeting_item_type;
begin
  if not public.can_edit_content() then
    raise exception 'Nu ai permisiunea să modifici programul.';
  end if;

  v_item_type := case
    when p_item_type in ('song', 'prayer', 'message', 'encouragement', 'text', 'break') then p_item_type::public.meeting_item_type
    else 'text'::public.meeting_item_type
  end;

  perform 1 from public.meetings where id=p_meeting_id for update;
  select coalesce(max(position),0)+1 into v_position from public.meeting_items where meeting_id=p_meeting_id;

  insert into public.meeting_items (
    meeting_id,
    position,
    item_type,
    custom_title,
    custom_text
  )
  values (
    p_meeting_id,
    v_position,
    v_item_type,
    p_custom_title,
    p_custom_text
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.duplicate_meeting(p_meeting_id uuid,p_title text,p_meeting_date timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_meeting public.meetings;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  if nullif(trim(p_title),'') is null or p_meeting_date is null then raise exception 'Titlul și data sunt obligatorii.'; end if;
  select * into v_meeting from public.meetings where id=p_meeting_id for share;
  if not found then raise exception 'Programul nu există.'; end if;
  insert into public.meetings(title,meeting_type,meeting_date,notes,created_by,status,principal_responsible,secondary_responsibles) values(trim(p_title),v_meeting.meeting_type,p_meeting_date,v_meeting.notes,auth.uid(),'draft',v_meeting.principal_responsible,v_meeting.secondary_responsibles) returning id into v_id;
  insert into public.meeting_items(meeting_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name)
    select v_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name from public.meeting_items where meeting_id=p_meeting_id;
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
commit;


-- FILE: 040_v46_usage_and_live_program.sql
begin;
-- Revision guards live client state against a delayed/stale route render.
alter table public.meetings add column if not exists program_revision bigint not null default 0;
create or replace function public.bump_program_revision_v46() returns trigger language plpgsql set search_path=public as $$
begin new.program_revision := old.program_revision + 1; return new; end $$;
drop trigger if exists meetings_revision_v46 on public.meetings;
create trigger meetings_revision_v46 before update on public.meetings for each row execute function public.bump_program_revision_v46();
create or replace function public.touch_program_items_v46() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op <> 'INSERT' then update public.meetings set updated_at=now() where id=old.meeting_id; end if;
  if tg_op='INSERT' or (tg_op='UPDATE' and new.meeting_id<>old.meeting_id) then
    update public.meetings set updated_at=now() where id=new.meeting_id;
  end if;
  return null;
end $$;
drop trigger if exists meeting_items_revision_v46 on public.meeting_items;
create trigger meeting_items_revision_v46 after insert or update or delete on public.meeting_items for each row execute function public.touch_program_items_v46();
create or replace function public.get_meeting_snapshot_v46(p_meeting_id uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object('revision',m.program_revision,'principal',m.principal_responsible,'secondary',m.secondary_responsibles,
    'items',coalesce((select jsonb_agg(to_jsonb(mi)||jsonb_build_object('songs',
      case when s.id is null then null else jsonb_build_object('id',s.id,'title',s.title,'lyrics_text',s.lyrics_text,'default_key',s.default_key,'bpm',s.bpm,'structure',s.structure) end) order by mi.position,mi.id)
    from public.meeting_items mi left join public.songs s on s.id=mi.song_id where mi.meeting_id=m.id),'[]'::jsonb))
  from public.meetings m where m.id=p_meeting_id;
$$;
revoke all on function public.get_meeting_snapshot_v46(uuid) from public,anon;
grant execute on function public.get_meeting_snapshot_v46(uuid) to authenticated;

-- One occurrence per real meeting. Backups, templates and future dates are excluded.
create or replace view public.song_performance_occurrences_v46 with (security_invoker=true) as
select distinct mi.song_id,m.id as meeting_id,m.title as meeting_title,m.meeting_date,m.meeting_type
from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
where mi.song_id is not null and not mi.is_backup and not m.is_template and m.meeting_date<=now();
revoke all on public.song_performance_occurrences_v46 from public,anon;
grant select on public.song_performance_occurrences_v46 to authenticated;
create index if not exists meeting_items_performance_v46 on public.meeting_items(song_id,meeting_id) where song_id is not null and not is_backup;

create or replace function public.get_song_history_v46(p_song_id uuid,p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security invoker set search_path=public as $$
with uses as materialized (select * from public.song_performance_occurrences_v46 where song_id=p_song_id),
rows as (select * from uses order by meeting_date desc,meeting_id limit least(greatest(coalesce(p_page_size,30),1),100) offset (greatest(coalesce(p_page,1),1)::bigint-1)*least(greatest(coalesce(p_page_size,30),1),100))
select jsonb_build_object('total',(select count(*) from uses),'last_used_at',(select max(meeting_date) from uses),
  'entries',coalesce((select jsonb_agg(to_jsonb(rows) order by meeting_date desc,meeting_id) from rows),'[]'::jsonb));
$$;
revoke all on function public.get_song_history_v46(uuid,integer,integer) from public,anon;
grant execute on function public.get_song_history_v46(uuid,integer,integer) to authenticated;

create or replace function public.list_song_library_v46(
  p_collection uuid default null, p_category uuid default null, p_number text default null,
  p_status text default null, p_key text default null, p_sort text default 'title_asc',
  p_page integer default 1, p_page_size integer default 50, p_query text default null
) returns jsonb language sql stable security invoker set search_path = public as $$
with usage as materialized (
  select song_id,count(*) as times_sung,max(meeting_date) as last_used_at
  from public.song_performance_occurrences_v46 group by song_id
), filtered as materialized (
  select s.id,s.title,s.default_key,s.bpm,s.structure,s.created_at,coalesce(u.times_sung,0) as times_sung,u.last_used_at,
    (select min(nullif(regexp_replace(src.song_number,'[^0-9]','','g'),'')::numeric)
       from public.song_sources src where src.song_id=s.id
       and (p_collection is null or src.collection_id=p_collection)) as source_number
  from public.songs s left join usage u on u.song_id=s.id
  where s.is_active
    and (p_sort is distinct from 'most_sung' or coalesce(u.times_sung,0)>0)
    and (nullif(trim(p_query),'') is null
      or s.search_vector @@ plainto_tsquery('simple',public.unaccent(p_query))
      or s.search_text ilike '%'||lower(public.unaccent(p_query))||'%'
      or exists(select 1 from public.song_sources ss where ss.song_id=s.id and
        (ss.song_number ilike '%'||p_query||'%' or lower(public.unaccent(coalesce(ss.source_title,''))) ilike '%'||lower(public.unaccent(p_query))||'%')))
    and (p_key is null or s.default_key=p_key)
    and (p_collection is null or exists(select 1 from public.song_sources src where src.song_id=s.id and src.collection_id=p_collection))
    and (p_category is null or exists(select 1 from public.song_categories c where c.song_id=s.id and c.category_id=p_category))
    and (nullif(trim(p_number),'') is null or exists(select 1 from public.song_sources src where src.song_id=s.id and (src.song_number ilike '%'||p_number||'%' or src.source_title ilike '%'||p_number||'%')))
    and (p_status is null or exists(select 1 from public.song_files f where f.song_id=s.id and f.import_status::text=p_status))
), paged as (
  select * from filtered
  order by
    case when p_sort='most_sung' then times_sung end desc nulls last,
    case when p_sort in ('most_sung','last_sung') then last_used_at end desc nulls last,
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
revoke all on function public.list_song_library_v46(uuid,uuid,text,text,text,text,integer,integer,text) from public,anon;
grant execute on function public.list_song_library_v46(uuid,uuid,text,text,text,text,integer,integer,text) to authenticated;

create or replace function public.get_song_recent_usage(days_back integer default 30)
returns table(song_id uuid,title text,last_used_at timestamptz,times_used bigint,last_meeting_title text)
language sql stable security invoker set search_path=public as $$
with ranked as (
 select o.*,s.title,row_number() over(partition by o.song_id order by o.meeting_date desc,o.meeting_id) as rn
 from public.song_performance_occurrences_v46 o join public.songs s on s.id=o.song_id
 where o.meeting_date>=now()-make_interval(days=>greatest(coalesce(days_back,30),0))
 
) select song_id,title,max(meeting_date),count(*),max(meeting_title) filter(where rn=1) from ranked group by song_id,title order by max(meeting_date) desc;
$$;

create or replace function public.get_song_recent_usage_excluding_meeting(days_back integer default 30, excluded_meeting_id uuid default null)
returns table(song_id uuid,title text,last_used_at timestamptz,times_used bigint,last_meeting_title text)
language sql stable security invoker set search_path=public as $$
with ranked as (
 select o.*,s.title,row_number() over(partition by o.song_id order by o.meeting_date desc,o.meeting_id) as rn
 from public.song_performance_occurrences_v46 o join public.songs s on s.id=o.song_id
 where o.meeting_date>=now()-make_interval(days=>greatest(coalesce(days_back,30),0))
 and (excluded_meeting_id is null or o.meeting_id<>excluded_meeting_id)
) select song_id,title,max(meeting_date),count(*),max(meeting_title) filter(where rn=1) from ranked group by song_id,title order by max(meeting_date) desc;
$$;
notify pgrst,'reload schema';
commit;


-- FILE: 041_v46_youth_keys.sql
begin;
create table if not exists public.youth_key_reference_v46 (
 reference_number text primary key, title text not null, musical_key text, original_notation text not null
);
alter table public.youth_key_reference_v46 enable row level security;
drop policy if exists youth_key_reference_read on public.youth_key_reference_v46;
create policy youth_key_reference_read on public.youth_key_reference_v46 for select to authenticated using (exists(select 1 from public.profiles where id=auth.uid() and is_active));
grant select on public.youth_key_reference_v46 to authenticated;
insert into public.youth_key_reference_v46(reference_number,title,musical_key,original_notation) values
('1','Am fost nascut in pacat','F','F'),
('2','Cand furtuni in viata-mi vin','C','C'),
('3','El este Domn si domneste in ceruri','E','E'),
('4','Iata-mi naintea Ta','G','G'),
('5','Al meu Domn, parinte','A','A'),
('6','Doamne, azi eu vin','G','G'),
('7','O lume intreaga sta in nepasare','D','D'),
('8','Suntem prin Domnul Isus','G','G'),
('9','Ochii Domnului plini de dragoste privesc','G','G'),
('10','In casa ta, doamne, aud cuvantul sfant','G','G'),
('11','Ne despartin, la drum pornim','F','F'),
('12','Eram jos in pacat','A','A'),
('13','Viata tinereasca','G','G'),
('14','Ne-a aratat raul vietii','A','A'),
('15','Nu este munte prea-nalt','A','A'),
('16','O, de-ai vrea sa vii la el','G','G'),
('17','Pe Isus L-am primit cand m-a chemat','F','F'),
('18','Pentru tine-un pacatos','Am','a'),
('19','Pleaca-ti genunchii, Isus e-aici','A','A'),
('20','Domn peste pamant','C','C'),
('20b','Lumina Ta.','C','C'),
('21','Domnul este lumina in nopatea cea grea','D','D'),
('22','Duhul Domnului este putere','E','E'),
('23','Primeste lauda si inchinarea','C','C'),
('24','Cant Doamne-n Templul Tau','C','C'),
('25','In lumina iubirii tale','G','G(sau A)'),
('26','Tu esti domn al creatiei, al lumii-ntregi','C','C'),
('27','Cu nerabdare astept ziua','F','F'),
('27b','Lasati duhul sfant sa lucreze','E','E'),
('28','Osana, Osana, Osana-n inaltime','F','F'),
('29','Inaintea Mielului curand vom sta','F','F'),
('30','Maret esti Dumnezeu','C','C'),
('31','Voi slavi pe mielul gloriei','D','D'),
('32','Ai un loc la cruce si tu','E','E'),
('33','Aud ciocanele cum bat','F','F'),
('34','Ai fost rastignit','F','F'),
('35','El e Domn','F','F'),
('36','A treia zi, din morti Isus a inviat','E','E'),
('37','E viu, e viu, e viu in orice timp','E','E'),
('38','Hristos din morti a inviat in slava Lui','A','A'),
('39','A inviat Isus Cristos','E','E'),
('40','Aleluia, Aleluia, Aleluia el e domn','C','C'),
('41','Cerul declara gloria celui inviat','A','A'),
('42','El ne-a iubit venind in lume','G','G'),
('43','Nici un prieten nu e bun ca Isus','D','D'),
('44','Din gura-n gura salutul Cristos a-nviat','C','C'),
('45','Chiar in drum spre Ierihon','A','A'),
('46','Dumnezeu este iubirea','Eb','Eb'),
('47','Isus iubit, noi te adoram','F','F'),
('48','Pe marea vietii o barca pluteste usor','C','C'),
('49','Numai prin gratia lui isus','C','C'),
('50','Spre slava Sa, cantari de lauda','C','C'),
('51','Cand aud in departare','A','A'),
('52','Iti vom canta, Doamne, Tie','E','E'),
('53','Jos la picioarele-Ti stau','A','A'),
('54','Pot sa se mute muntii','F','F'),
('55','As vrea sa Te cunosc','F','F'),
('56','Caci iata ca El a intocmit muntii','A','A'),
('57','Cat de bine ma simt cu alesii Domnului','F','F'),
('58','E-o minune cand soarele-apune','C','C'),
('59','Cuvinte nu gasesc, Isuse bun','E','E'),
('60','Doar langa Tine-mi aflu pacea','G','G'),
('61','Cum doreste un cerb','C','C'),
('62','Eu ma-ncred doar in Domnul','F','F'),
('63','In aceasta ora, Doamne, Te rugam','Cm','c'),
('64','Inima-mi canta de bucurie','Bb','Bb'),
('65','Nu va fi o veste mai frumoasa','G','G'),
('66','O, fa-ma un instrument','E','E'),
('67','Omule, ce stai acum','E','E'),
('68','Sa ''nalt jerfta Ta, isuse','Fm','f'),
('69','Sa-ngenuchezi, Hrist te va primi','G','G'),
('70','Sa venim naintea Lui','F','F'),
('71','Si daca incercarea loveste fara mila','Eb','Eb'),
('72','Singur eram in aceasta lume','C','C'),
('73','Sunt aici, la dispozitia Ta','F','F'),
('74','Suntem stransi in jurul Lui','E','E'),
('75','Te-am gasit pe muntii inalti','D','D'),
('76','Vei secera candva','E','E'),
('77','Spre tine, doamne, indrept azi glasul',null,''),
('78','Tu-mi esti lumina','D','D'),
('79','O inima curata, doamne','E','E'),
('80','Stau si privesc ochii adanci','Em','e'),
('81','Renuntand la gandurile mele','G','G'),
('82','Cerul e orasul de dincolo de nori','G','G'),
('83','Astazi vin la tine domnul meu','F','F'),
('84','Doamne, te onoram','E','E'),
('85','Cand privesc bolta-nstelata','B','B'),
('86','El e-aici, aleluia','Db','Db'),
('87','Atatia oameni n-au nici-o tinta','E','E'),
('88','Doamne, Tu esti Dumnezeu','F','F'),
('89','Spala-mi, Doamne, gandul','G','G'),
('90','Aleluia, onoare si cinste','G','G'),
('91','Aleluia, onoare si cinste','G','G'),
('92','Astazi ma-nchin Domnului','F','F'),
('93','Eu nu stiu cat timp','F','F'),
('94','Inima mea vrea sa-ti cante','A','A'),
('95','Nimeni, doar tu, doamne','G','G'),
('96','Caci pentru mine a trai este Hristos','F','F'),
('97','Cand drumul vietii e greu','A','A'),
('98','Drag prieten',null,''),
('99','Cu gandul spre ceruri',null,''),
('100','Inima mea tanjeste dupa curtile Tale','C','C'),
('101','Asa de-aproape de Tin',null,''),
('102','Stam in a ta prezenta',null,''),
('103','Voi binecuvanta pe Domnul in orice vreme','C','C'),
('104','Se cuvine sa te laud','C','C'),
('105','La tine, Doamne','E','E'),
('106','Arunc grijile asupra Ta','D','D'),
('107','Ma aflam pe-a mea carare','F','F'),
('108','Am fost mantuiti','F','F'),
('109','Speranta mea e Isus','E','E'),
('110','Veniti, cantati lui Dumnezeu','C','C'),
('111','Am gasit in Domnul fericirea','C','C'),
('112','Din Betleem la Calvar','F','F'),
('113','Tu-mi esti refugiu','G','G'),
('114','Ce bucurie sa ma stiu copilul tau','G','G'),
('115','Fiindca atat de mult',null,''),
('116','Ne-ntoarcem azi sa-ti multumim','F','F'),
('117','Drumul vietii am gasit','F','F'),
('118','Ai platit un pret','F','F'),
('119','Iata, apar stele','F','F'),
('120','La tine venim','A','A'),
('121','Vocea lui se aude','E','E'),
('122','Cand vrei sa vii',null,''),
('123','Sus la Calvar',null,''),
('124','maretul har','F','F'),
('125','Am gasit o dulce mangaiere','Eb','Eb'),
('126','Am gresit de atatea ori','E','E'),
('127','Slavesc pe creatorul','F','F'),
('128','Haideti, crestini, azi cu toti','C','C'),
('129','Spala-mi, doamne, gandul','G','G'),
('130','Cand Isus Hristos m-a mantuit','G','G'),
('131','Doamne-n tine ma incred','A','A'),
('132','Imnuri de slava spre cer se inalta','G','G'),
('133','O cantare de marire','C','C'),
('134','Vesnic slaca tie','Eb','Eb'),
('135','Cu totii sa cantam','G','G'),
('136','Da, chiar in curand','E','E'),
('137','Eu pe domnul iubesc','F','F'),
('138','Inima mea','E','E'),
('139','Cu Isus in lumea asta','F','F'),
('140','O, Isus, miel divin','G','G'),
('141','Ca stropii de roua','F','F'),
('142','Dupa ploaie si furtuna','E','E'),
('143','Cand eram pandit de-o ispita','D','D'),
('144','Domane, fa al meu cuvant','D','D'),
('145','Doar o coliba','C','C'),
('146','Sfarsitul veacului traim','G','G'),
('147','Cerul e-un loc minunat','G','G'),
('148','Sunt strajerul care striga','C','C'),
('149','Impreuna din nou','F','F'),
('150','Pe pamant vom gasi','G','G'),
('151','Viata far de tine','C','C'),
('152','O lume pagana',null,''),
('153','Vreau langa Dumnezeu','E','E'),
('154','Strang cuvantul tau','C','C'),
('155','Tie-ti dam slava si onoare','C','C'),
('156','Schimba-mi inima','C','C'),
('157','Deschide-mi ochii','E','E'),
('158','Tu stai mai sus de ceruri','G','G'),
('159','De tine ocrotiti','G','G'),
('160','Ganduri negre ma pandesc','G','G'),
('161','Doamne, vreau sa-ti multumesc','Eb','Eb'),
('162','De nu poti sa platesti',null,''),
('163','Cand zorii se-arata','D','D'),
('164','Suntem aici, in prezenta ta',null,''),
('165','Dumnezeu e dragoste','C','C'),
('166','Spala-ma in raul dragostei',null,''),
('167','Doamne, esti mai scump ca argintul','F','F'),
('168','Tu esti pastorul meu, al sufletului meu','E','E'),
('169','Isus, izvorul vietii noastre','D','D'),
('170','In numele celui ce ne-a iubit','D','D'),
('171','Doua maini, astazi, Doamne','G','G'),
('172','Hristos, in Cana Galileii','C','C'),
('173','In seara-aceasta, inaintea voastra','E','E'),
('174','Iata ziua ce-ati cerut-o','E','E'),
('175','Azi, te rog, Isuse din slava','E','E'),
('176','Bine-ati venit azi la altar','A','A'),
('177','Vino, Isus, la nunta','C','C'),
('178','O, Isus, te imploram',null,''),
('179','Dragoste, dragoste','A','A'),
('180','La nunta voastra','F','F'),
('181','Azi e o zi de sarbatoare',null,''),
('182','Ce dar sa-i dau regelui','C','C'),
('183','O, ce veste minunata','F','F'),
('184','O, noapte preasfintita','Bb','Bb'),
('185','E nopate si toata lumea doarme','C','C'),
('186','O, ce veste imbucuratoare','D','D'),
('187','Cantati toti de bucurie','C','C'),
('188','Veniti credinciosi azi plini de bucurie','F','F'),
('189','Cu mult in urma-n Betleem','Bb','Bb'),
('190','In seara-aceasta totu-i minunat','E','E'),
('191','Intr-un staul mic','F','F'),
('192','In mine-a rasarit','Eb','Eb'),
('193','E noapte in Iudeea','E','E'),
('194','Noapte de Craciun','D','D'),
('195','Hristos ni s-a nascut','D','D'),
('196','Trei pastori au auzit','A','A'),
('197','Auzi corul ingeresc','G','G'),
('198','De-a lungul vietii tale','E','E'),
('199','Glorie, S-a nascut Mesia','F','F'),
('200','Ingerii canta-n cor','F','F'),
('201','Iata vestea ce-a venit din cer',null,''),
('202','Dulce rasuna prin noapte','C','C'),
('203','Veniti la Betleem sa-l vedeti pe el','F','F'),
('204','Domnul m-a gasit','A','A'),
('205','Pe-oceanul infinit','F','F'),
('206','Nimeni in afara de tine','Bb','Bb'),
('207','Zi de zi, clipita de clipita','D','D'),
('208','Eu am pornit fericit pe-o carare','G','G'),
('209','Raspandeste lumina','D','D'),
('210','An nou de indurare',null,''),
('211','A lui Hristos venire','G','G'),
('212','Dragoste divina, sfanta','G','G'),
('213','Isus, viata noastra',null,''),
('214','Pe sfanta vietii carare','D','D'),
('215','Pierdut in lume',null,''),
('216','Dupa cum este scris',null,''),
('217','Am venit aici cu toti',null,''),
('218','Ce dulce este mesajul',null,''),
('219','Hai sa laudam pe Domnul Sfant',null,''),
('220','M-am hotarat sa-l urmez pe Isus','C','C'),
('221','Toate darurile de-as avea',null,''),
('222','De traiesti cu Domnul tau mereu',null,''),
('223','Daca vei vrea sa primesti',null,''),
('224','Cand frigul patrunde in suflet','A','A'),
('225','Cu-ndurare el m-a ridicat','D','D'),
('226','Asculta glasul ce te cheama',null,''),
('227','Cat de bogat si minunat',null,''),
('228','Dincolo de cer','Db','Db'),
('229','Binecuvantari ma inconjoara','C','C'),
('230','Cand incercarile prea grele ni se par',null,''),
('231','Azi Domnul este pastorul meu','Em','e'),
('232','Cand in inima-ti rasare o lumina','E','E'),
('233','Canta ingerii voios','G','G'),
('234','In Betleem e noapte linistita',null,''),
('235','Vestea buna ingeri au adus','G','G'),
('236','Cel nascut in Betleem',null,''),
('237','Multumesc de tot ce-mi dai sa vad',null,''),
('238','Lui Isus astazi ii cant','F','F'),
('239','Sunt zilele din urma',null,''),
('240','Sunt in fiecare zi cu Isus',null,''),
('241','Tinerii lui Isus',null,''),
('242','Toti ar trebui sa stim','E','E'),
('243','Fiti voiosi, fiti voiosi totdeauna',null,''),
('244','Zi de zi, clipita de clipita','D','D'),
('245','Inteleptii lumii ma inconjoara','E','E'),
('246','Ce mare si bun','C','C'),
('247','Drumtul tau cand iti este singur',null,''),
('248','Nu la intamplare sunt','G','G'),
('249','Cant Domnului ca mi-a facut bine','G','G'),
('250','Mai sus de oameni','A','A'),
('251','Traim vremi de har','G','G'),
('252','Tot ce-aveam mai bun','D','D'),
('253','Peste-ntreg pamant','C','C'),
('254','Stau din nou, gandidu-ma','D','D'),
('255','Isus e mangaierea mea','E','E'),
('256','Ascultam Doamne, lauda mea','B','B'),
('257','M-a aflat al meu Pastor','C','C'),
('258','Tine-ma in mana ta','C','C'),
('259','Muzica-ncetat','E','E (E   B/D#   f#)'),
('260','Isus, vreau sa merg',null,''),
('261','Viata si miscarea si suflarea sunt in tine','G','G'),
('262','Iubirea lui e mult prea mare','D','D'),
('263','Nu stiu de ce sunt ispite-adesea',null,''),
('264','Lumina lumii, prezenta divina',null,''),
('265','In fata tronului de sus','D','D'),
('266','O, tata sfant, noi te iubim','Bb','Bb'),
('267','Iti multumesc din inima','F','F'),
('268','Doamne, bunatatea ta','F','F'),
('269','L-am vazut pe Isus pe Golgota urcand','G','G->Ab->A'),
('270','Vreau sa spuna cel ce-i slab','C','C'),
('271','Eu nu te vad, dar stiu ca esti aici',null,''),
('272','Ne plecam in umilinta',null,''),
('273','Simt prezenta slavei Tale','D','D'),
('274','Domnul ne-a creat dupa chipul sau','F','F'),
('275','Sunt iertat, caci ai fost parasit',null,''),
('276','Nu vreau sa fiu ingrijorat','G','G'),
('277','Cel ce linisteste marea',null,''),
('278','Cand eram cazut, tu m-ai ridicat','Bb','Bb'),
('279','Voi pierduti cu sarcini grele','E','E'),
('280','Ce mare esti tu, ce mare e mila ta','C','C'),
('281','Astazi cant voios','C','C'),
('282','Zi de zi, din fantana mantuirii','F','F'),
('283','Domnu-i bun, orisicand','D','D'),
('284','Aleluia, aleluia,  domnul nostru',null,''),
('285','Astazi nu mai sunt minuni','G','G'),
('286','Cand eu stau si ma gandesc',null,''),
('287','Canta, sriga, bate din palme','E','E'),
('288','Cel ce linisteste marea','C','C ( sau D )'),
('289','Cel ce sta sub ocrotirea','Bb','Bb'),
('290','Cred in Dumnezeu ca tata','E','E'),
('291','Curgi ca un rau de slava','D','D'),
('292','Din el, prin el si pentru el','Em','e'),
('293','Doamne, da-ne-ntelepciune','E','E'),
('294','Zorile rasar','Am','a'),
('295','Eu nu te vad','C','C'),
('296','Fara muzica',null,''),
('297','Fii a mea lumina','D','D'),
('298','Isus, ce bucurie',null,''),
('299','Iubire-adanca-a tatalui','E','E'),
('300','Langa tine vreau','G','G'),
('301','Lumina lumii','D','D'),
('302','Marturisim acum ca suntem slabi','Bb','Bb   (ref:  c  Bb/D     Eb)'),
('303','Medley',null,''),
('304','Ne plecam in umilinta',null,''),
('305','Nu-i pe lume nici-o cale',null,''),
('306','Numai un pas spre Domnul','G','G'),
('307','O schimbare','D','D'),
('308','O, miel ceresc','C','C'),
('309','Preaiubitul meu e Isus','G','G'),
('310','Sangele tau, vorbeste mai profund','A','A'),
('311','Tata, noi vrem','F','F'),
('312','Un tron inalt e-n cer','E','E'),
('313','Unii spun ca nu poti fi gasit','A','A'),
('314','Medley2',null,''),
('315','Cinste, onoare, glorie, splendoare','C','C'),
('316','Cum pot rasplati eu','E','E'),
('317','Rege-al regilor, esti tu','Bb','Bb'),
('318','Imi va ramane-n memorie-o zi','F','F'),
('319','Zi de zi eu vreau',null,''),
('320','Ce mare esti','A','A'),
('321','Fara el nimic nu poti face',null,''),
('322','Iata-ma smerit de maiestatea ta','A','A'),
('323','Pacatele imbatranesc','D','D'),
('324','Esti vrednic, Doamne','F','F'),
('325','Speranta mea e in Isus','D','D'),
('326','E-a treia zi de cand muri','E','E'),
('327','ZIdeste in mine','F','F'),
('328','Cu tot e am, cu tot ce sunt',null,''),
('329','Golgota','F','F'),
('330','Spune-mi te-ai gandit','Eb','Eb'),
('331','Vine o zi cand vom pleca','F','F'),
('332','Doamne numele-ti inalt','G','G'),
('333','Veniti sa ii multumim','F','F'),
('334','Spune-mi ce este viata omului','C','C'),
('335','Hai, hai e timpul de-nchinare','D','D'),
('336','Alelu et-Adonai','Am','a'),
('337','Ai deschis cerul tau','A','A'),
('338','Aleluia, aleluia','A','A'),
('339','Doamne, vreau sa ma-nchin','F','F'),
('340','Destinul tau e sa invingi','E','E'),
('341','Vrednic esti de cinste','C','C'),
('342','Cei trei magi din rasarit','Em','e'),
('343','S-a nascut in Betleem',null,''),
('344','Ingerul din cer vestise','E','E'),
('345','Fiindca nu am smirna','D','D'),
('346','E craciun acuma iar',null,''),
('347','O noapte sfanta binecuvantata','A','A'),
('348','Zideste in mine','F','F'),
('349','Doamne azi venim cu pruncul','F','F'),
('350','Tu din vanturi faci solii.','C','C'),
('351','Binecuvanteaza, suflete','D','D'),
('352','Doamne daca vrei','Bm','b'),
('353','Am ales pe Domnul Isus','G','G'),
('354','Aceasta e','G','G'),
('355','Inainte sa-mi vorbesti','D','D'),
('356','Dumnezeu e taria mea','Em','e'),
('357','In tine este viata mea','F','F'),
('358','El shadai','F','F'),
('359','Eu sunt un om, sunt doar un om','C','C'),
('360','Tu ma ridici','C','C'),
('361','Uimit de-atata bogatie','F','F'),
('362','Am venit dni departare','G','G'),
('363','Doamne tu esti bucuria mea','F','F'),
('364','',null,''),
('365','Hai spune-mi cine a biruit moartea','Fm','f'),
('366','Lauda cinste onoare','G','G'),
('367','Eu stiu ca m-ai mantuit','F','F'),
('368','Pentru soare si ploaie','F','F'),
('369','Iti multumesc pentru speranta','G','G'),
('370','Duhul tau mi-a fost un stalp de foc in noapte','Dm','d'),
('371','Tu esti sfant','E','E'),
('372','E o zi mareata','Eb','Eb'),
('373','Azi s-a nascut',null,''),
('374','O prunc divin',null,''),
('375','Laudat sa fii Isuse',null,''),
('376','Veniti sa ne-nchinam',null,''),
('377','O stea pe cer, lumineaz-acum','C','C'),
('378','Rama linistit','D','D'),
('379','Ierusalim','C','C'),
('380','Scumpa vesnicia','F','F'),
('381','Leaga-ti inima de cer','Eb','Eb'),
('382','Voi inalta numele Tau','E','E'),
('383','Al meu domn puternic (hillsong)','F','F'),
('384','El e sfant','Am','a'),
('385','Nimeni nu e ca el, mare e Dumnezeu','E','E'),
('386','Zi de zi esti cu mine','A','A'),
('387','Domnul sta in fruntea oastei lui','Am','a'),
('388','In orice suflet e-un tainic dor','A','A'),
('389','Cand se naste un copil','D','D'),
('390','Fii binecuvantat','A','A'),
('391','Cum sa nu-ti cant eu laude-n veci','E','E'),
('392','Mare esti, rege in veci de veci','A','A 66'),
('393','Eu intru in sfanta-ti prezenta','Em','e'),
('394','Noi cantam','Eb','Eb'),
('395','Rege si rob smerit','C','C'),
('396','Cand spre tine imi intorc privirea','C','C'),
('397','Doamne Tu ce misti chiar muntii','G','G'),
('398','Un cantec de lauda.','E','E'),
('399','Toate le-ai creat','E','E'),
('400','Sunt un pribeag fara de tara','Cm','c'),
('401','Orice pas Isus mi-l conduce',null,''),
('402','Nu sunt in ceruri lacrimi','F','F'),
('403','Tu esti izvorul vietii mele',null,''),
('404','Cetate tare','E','E'),
('405','Apa-i schimbat-o in vin','E','E'),
('406','Ne-ai ales ca sa traim','A','A'),
('407','Isus s-a nascut','G','G'),
('408','10000 motive','D','D'),
('409','Eternul Dumnezeu',null,''),
('410','Eu de tine am nevoie','D','D'),
('411','In el in Domnul meu','F','F->G->A'),
('412','Inviat','F','F'),
('413','Ai biruit mormantul','A','A'),
('414','In inima ta',null,''),
('415','Traiesc pentru tine',null,''),
('416','Dragostea','F','F'),
('417','Har din cer si binecuvantare','E','E'),
('418','Pentru cruce-ti multumesc','A','A'),
('419','El va ramane credincios',null,''),
('420','Vesnic aleluia',null,''),
('421','Isus o ce nume frumos','D','D'),
('422','Mare domn avem','G','G'),
('423','Crezul','F','F'),
('424','Hai deschide inima ta',null,''),
('425','Lipeste-mi Doamne, sufletul de tine','C','C'),
('426','Rabuni, tu din morti ai inviat','E','E'),
('427','Fratilor credinta noastra s-o pazim','Cm','c'),
('428','Ce dar maret e Isus Salvatorul','D','D'),
('429','Credinta mea eu o zidesc','D','D'),
('430','O carte cu sapte peceti','Gm','g'),
('431','Isus cu slava imbracat','C','C'),
('432','Eu am un creator','C','C'),
('433','Fericirea e in inimi',null,''),
('434','Nu va injugati la un jug nepotrivit','Dm','d'),
('435','Noi suntem una-n Isus',null,''),
('436','Vreau sa stiu ce e sfant',null,''),
('437','Pe Isus cu cat il cunosc',null,''),
('438','Un singur Dumnezeu',null,''),
('439','Cand ma aflu-n prezenta ta','Eb','Eb'),
('440','Numele tau e minunat','Dm','d'),
('441','Glorie, vreau sa ii cant glorie',null,''),
('442','Haideti sa cantam cu veselie Domnului','A','A'),
('443','Cu Isus vreau sa-mi continui calea','D','D'),
('444','Venim in a ta prezenta','D','D'),
('445','Eu cand osana, cant aleluia','G','G'),
('446','Om al durerii, miel divin','C','C'),
('447','Am venit cu bucurie',null,''),
('448','Voi rezidi altarul','C','C'),
('449','Spala-ma in raul dragostei','Dm','d'),
('450','Acum paraseste',null,''),
('451','Drumul slavei trece doar pe la cruce','Cm','c'),
('452','Aceasta-mi e dorinta',null,''),
('453','Suflete scoala din amorteala','Dm','d'),
('454','Cand zaceam sub grea povara',null,''),
('455','Pazeste-ti piciorul',null,''),
('456','Voi numai de viata asta',null,''),
('457','Pentru noi e taina mare','Bb','Bb'),
('458','Cel minunat, salVatorul','C','C'),
('459','Ne vom aduce mereu aminte','Db','Db   (modulatii: Db   D  E   F )'),
('460','Tu ma cercetezi de-aproape','G','G'),
('461','Toate lucrurile Doamne','Gm','g'),
('462','Tot mai sfant','E','E'),
('463','Atat am cautat rostul vietii','C','C'),
('464','Eu nu pot vorbi iscusit despre Tine','Cm','c (c   f   c   f   Bb9   Eb    G    f    c   C    f    G      Ab   Bb      c)'),
('465','Nu stiu cat mai am harul',null,''),
('466','Rasuna astazi in toate tarile',null,''),
('467','Noi ridicam catre cer','E','E'),
('470','El n-a promis doar cerul senin','F','F'),
('474','pe genunchi',null,'D/E'),
('491','Isus îți dau viața mea','A','A'),
('499','Lui Isus toată slava','C','C'),
('500','Mărețul har - lanțul s-a rupt','D','D'),
('501','Valoarea mea nu stă-n averi','D','D'),
('502','Cântăm Aleluia',null,'D/E')
on conflict(reference_number) do update set title=excluded.title,musical_key=excluded.musical_key,original_notation=excluded.original_notation;
create or replace function public.key_title_normalized_v46(p_title text)
returns text language sql stable security invoker set search_path=public as $$
 select trim(regexp_replace(lower(public.unaccent(regexp_replace(coalesce(p_title,''),'^\s*[0-9]+[a-z]?[.) -]+','','i'))),'[^a-z0-9]+',' ','g'));
$$;
create table if not exists public.youth_key_applied_v46 (
 song_id uuid primary key references public.songs(id) on delete cascade,
 previous_key text, applied_key text not null, applied_at timestamptz not null default now()
);
alter table public.youth_key_applied_v46 enable row level security;
drop policy if exists youth_key_applied_read on public.youth_key_applied_v46;
create policy youth_key_applied_read on public.youth_key_applied_v46 for select to authenticated using (exists(select 1 from public.profiles where id=auth.uid() and is_active));
grant select on public.youth_key_applied_v46 to authenticated;

-- No fuzzy matching and no number-only assignment. Prefer a matching number AND title.
create or replace function public.get_youth_key_matches_v46()
returns table(reference_number text,title text,musical_key text,original_notation text,song_id uuid,match_status text)
language sql stable security invoker set search_path=public as $$
with refs as materialized (
 select r.*,public.key_title_normalized_v46(r.title) as normalized_title from public.youth_key_reference_v46 r
), scoped as materialized (
 select distinct s.id as song_id,lower(trim(coalesce(ss.song_number,''))) as song_number,
 public.key_title_normalized_v46(s.title) as normalized_title,public.key_title_normalized_v46(ss.source_title) as source_title
 from public.song_sources ss join public.song_collections sc on sc.id=ss.collection_id join public.songs s on s.id=ss.song_id
 where s.is_active and sc.is_active
 and (upper(coalesce(sc.short_code,''))='TINERI' or public.key_title_normalized_v46(sc.name) in ('tineri','cantari tineri','cantarile tinerilor','cantari pentru tineri'))
), candidates as materialized (
 select distinct r.reference_number,r.musical_key,s.song_id,s.song_number=lower(r.reference_number) as same_number
 from refs r join scoped s on (r.normalized_title=s.normalized_title or r.normalized_title=s.source_title)
 where length(r.normalized_title)>2
), preferred as (
 select c.* from candidates c where c.same_number or not exists(select 1 from candidates p where p.reference_number=c.reference_number and p.same_number)
), unique_matches as (
 select reference_number,(array_agg(distinct song_id))[1] as song_id,count(distinct song_id) as n from preferred group by reference_number
), conflicts as (
 select u.song_id from unique_matches u join public.youth_key_reference_v46 r using(reference_number)
 where u.n=1 and r.musical_key is not null group by u.song_id having count(distinct r.musical_key)>1
)
select r.reference_number,r.title,r.musical_key,r.original_notation,
 case when u.n=1 and c.song_id is null then u.song_id else null end,
 case when r.musical_key is null then case when r.original_notation='' then 'no_key' else 'review_notation' end
 when u.n is null then 'no_match' when u.n>1 then 'ambiguous' when c.song_id is not null then 'conflicting_keys'
 when a.applied_key=r.musical_key and s.default_key=r.musical_key then 'applied'
 when a.song_id is not null and s.default_key is distinct from a.applied_key then 'edited_after_import'
 else 'matched' end
from public.youth_key_reference_v46 r left join unique_matches u using(reference_number)
left join conflicts c on c.song_id=u.song_id left join public.youth_key_applied_v46 a on a.song_id=u.song_id
left join public.songs s on s.id=u.song_id
order by nullif(regexp_replace(r.reference_number,'[^0-9]','','g'),'')::integer,r.reference_number;
$$;
revoke all on function public.get_youth_key_matches_v46() from public,anon;
grant execute on function public.get_youth_key_matches_v46() to authenticated;

-- Audited, repeatable assignment. A later manual edit is never overwritten on rerun.
with matches as materialized (select distinct song_id,musical_key from public.get_youth_key_matches_v46() where match_status='matched'),
logged as (
 insert into public.youth_key_applied_v46(song_id,previous_key,applied_key)
 select m.song_id,s.default_key,m.musical_key from matches m join public.songs s on s.id=m.song_id
 on conflict(song_id) do nothing returning song_id,applied_key
)
update public.songs s set default_key=l.applied_key from logged l where s.id=l.song_id;
notify pgrst,'reload schema';
commit;


-- FILE: 042_v47_workflows.sql
begin;
-- Assign numbers only to newly attached songs or explicitly cleared numbers.
create or replace function public.assign_song_source_number_v47() returns trigger language plpgsql security definer set search_path=public as $$
declare v_next numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.collection_id::text,47));
  if nullif(trim(new.song_number),'') is null then
    select coalesce(max(substring(song_number from '^[0-9]+')::numeric),0)+1 into v_next
    from public.song_sources where collection_id=new.collection_id and id is distinct from new.id;
    new.song_number:=v_next::text;
  end if;
  return new;
end $$;
drop trigger if exists song_sources_number_v47 on public.song_sources;
create trigger song_sources_number_v47 before insert or update of song_number,collection_id on public.song_sources for each row execute function public.assign_song_source_number_v47();
create or replace function public.ensure_manual_collection_v47() returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('songapp-manual-collection',47));
 select id into v_id from public.song_collections where short_code='MANUAL' and is_active limit 1;
 if v_id is null then
   insert into public.song_collections(name,short_code,source_type) values('Adăugate manual','MANUAL','manual')
   on conflict(short_code) do update set is_active=true returning id into v_id;
 end if;
 return v_id;
end $$;
revoke all on function public.ensure_manual_collection_v47() from public,anon;
grant execute on function public.ensure_manual_collection_v47() to authenticated;

-- Calendar includes scheduled meetings; popularity remains past-only.
create or replace function public.get_song_history_v46(p_song_id uuid,p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security invoker set search_path=public as $$
with uses as materialized (
 select distinct mi.song_id,m.id as meeting_id,m.title as meeting_title,m.meeting_date,m.meeting_type,(m.meeting_date>now()) as is_future
 from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
 where mi.song_id=p_song_id and not mi.is_backup and not m.is_template
), rows as (select * from uses order by meeting_date desc,meeting_id limit least(greatest(coalesce(p_page_size,30),1),100) offset (greatest(coalesce(p_page,1),1)::bigint-1)*least(greatest(coalesce(p_page_size,30),1),100))
select jsonb_build_object('total',(select count(*) from uses),'performed_total',(select count(*) from uses where not is_future),
 'upcoming_total',(select count(*) from uses where is_future),'last_used_at',(select max(meeting_date) from uses where not is_future),
 'entries',coalesce((select jsonb_agg(to_jsonb(rows) order by meeting_date desc,meeting_id) from rows),'[]'::jsonb));
$$;

-- Keep the complete previous versions when a merge is explicitly confirmed.
create table if not exists public.song_merge_history_v47 (
 id uuid primary key default gen_random_uuid(),primary_song_id uuid,merged_by uuid,merged_at timestamptz not null default now(),archived_songs jsonb not null
);
alter table public.song_merge_history_v47 enable row level security;
drop policy if exists merge_history_editor_read on public.song_merge_history_v47;
create policy merge_history_editor_read on public.song_merge_history_v47 for select to authenticated using(public.can_edit_content());
grant select on public.song_merge_history_v47 to authenticated;
revoke insert,update,delete on public.song_merge_history_v47 from public,anon,authenticated;
create or replace function public.merge_duplicate_songs(p_primary_song_id uuid,p_duplicate_song_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_duplicates uuid[];v_all uuid[];v_count integer;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
 if p_primary_song_id is null then raise exception 'Alege cântarea principală.'; end if;
 select array_agg(distinct id) into v_duplicates from unnest(p_duplicate_song_ids) id where id is not null and id<>p_primary_song_id;
 if coalesce(cardinality(v_duplicates),0) not between 1 and 1000 then raise exception 'Alege între 1 și 1000 de duplicate.'; end if;
 v_all:=array_append(v_duplicates,p_primary_song_id);
 perform id from public.songs where id=any(v_all) order by id for update;
 if (select count(*) from public.songs where id=any(v_all))<>cardinality(v_all) then raise exception 'Una dintre cântări nu mai există. Reîncarcă lista.'; end if;
 if not exists(select 1 from public.songs where id=p_primary_song_id and is_active) then raise exception 'Cântarea principală nu este activă.'; end if;
 insert into public.song_merge_history_v47(primary_song_id,merged_by,archived_songs)
 select p_primary_song_id,auth.uid(),jsonb_agg(jsonb_build_object('song',to_jsonb(s),'sections',(select jsonb_agg(to_jsonb(x) order by x.position) from public.song_sections x where x.song_id=s.id),
 'sources',(select jsonb_agg(to_jsonb(x)) from public.song_sources x where x.song_id=s.id),'key_audit',(select to_jsonb(x) from public.youth_key_applied_v46 x where x.song_id=s.id)))
 from public.songs s where s.id=any(v_duplicates);
 update public.meeting_items set song_id=p_primary_song_id where song_id=any(v_duplicates);
 update public.public_meeting_contributions set song_id=p_primary_song_id where song_id=any(v_duplicates);
 update public.song_files set song_id=p_primary_song_id where song_id=any(v_duplicates);
 update public.external_song_refs set song_id=p_primary_song_id where song_id=any(v_duplicates);
 update public.song_link_imports set song_id=p_primary_song_id where song_id=any(v_duplicates);
 -- Move the original source rows: INSERT ON CONFLICT followed by DELETE lost their own conflicting rows.
 update public.song_sources set song_id=p_primary_song_id where song_id=any(v_duplicates);
 insert into public.song_categories(song_id,category_id) select distinct p_primary_song_id,category_id from public.song_categories where song_id=any(v_duplicates) on conflict do nothing;
 insert into public.song_bible_references(song_id,bible_reference_id,theme,reason,confidence,created_by)
 select distinct p_primary_song_id,bible_reference_id,theme,reason,confidence,created_by from public.song_bible_references where song_id=any(v_duplicates) on conflict do nothing;
 delete from public.songs where id=any(v_duplicates);
 get diagnostics v_count=row_count;
 return jsonb_build_object('merged',v_count,'primarySongId',p_primary_song_id);
end $$;
revoke all on function public.merge_duplicate_songs(uuid,uuid[]) from public,anon;
grant execute on function public.merge_duplicate_songs(uuid,uuid[]) to authenticated;
create or replace function public.merge_duplicate_song_groups_v47(p_groups jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_group jsonb;v_primary uuid;v_duplicates uuid[];v_used uuid[]:='{}';v_ids uuid[];v_result jsonb;v_count integer:=0;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
 if jsonb_typeof(p_groups) is distinct from 'array' or jsonb_array_length(p_groups) not between 1 and 200 then raise exception 'Alege între 1 și 200 de grupuri afișate.'; end if;
 -- Validate every plan before any write; a song cannot participate in two groups.
 for v_group in select * from jsonb_array_elements(p_groups) loop
   v_primary:=(v_group->>'primary')::uuid;
   select array_agg(distinct value::uuid) into v_duplicates from jsonb_array_elements_text(v_group->'duplicates') where value::uuid<>v_primary;
   if coalesce(cardinality(v_duplicates),0)=0 then raise exception 'Un grup nu are duplicate selectate.'; end if;
   v_ids:=array_append(v_duplicates,v_primary);
   if v_used&&v_ids then raise exception 'O cântare apare în mai multe grupuri.'; end if;
   if (select count(distinct public.normalize_song_title_for_duplicates(title)) from public.songs where id=any(v_ids))<>1 then raise exception 'Grupul conține titluri diferite. Verifică selecția.'; end if;
   v_used:=v_used||v_ids;
 end loop;
 perform id from public.songs where id=any(v_used) order by id for update;
 for v_group in select * from jsonb_array_elements(p_groups) loop
   v_primary:=(v_group->>'primary')::uuid;
   select array_agg(value::uuid) into v_duplicates from jsonb_array_elements_text(v_group->'duplicates');
   v_result:=public.merge_duplicate_songs(v_primary,v_duplicates);v_count:=v_count+(v_result->>'merged')::integer;
 end loop;
 return jsonb_build_object('merged',v_count,'groups',jsonb_array_length(p_groups));
end $$;
revoke all on function public.merge_duplicate_song_groups_v47(jsonb) from public,anon;
grant execute on function public.merge_duplicate_song_groups_v47(jsonb) to authenticated;

create or replace function public.import_reviewed_song_link(
  p_source_key text,p_url text,p_title text,p_lyrics text,p_sections jsonb,
  p_collection_ids uuid[],p_existing_song_id uuid default null,p_notes text default null,
  p_structure text default null,p_song_number text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_song uuid; v_mapped uuid; v_collection uuid; v_file uuid; v_new boolean:=false; v_collections uuid[]; v_linked integer:=0;
begin
  if not public.can_edit_content() then raise exception 'Nu ai permisiunea pentru import.' using errcode='42501'; end if;
  if p_url is null or length(p_url)>2000 or p_url !~ '^https?://[^/[:space:]@]+(/|$)' or p_source_key is null then raise exception 'Link invalid.'; end if;
  if p_source_key like 'resursecrestine:%' then
    if p_url !~ '^https://www\.resursecrestine\.ro/cantece/[0-9]+/[^/?#]+$' or p_source_key <> 'resursecrestine:'||substring(p_url from '/cantece/([0-9]+)') then raise exception 'Link invalid.'; end if;
  elsif p_source_key <> 'web:'||encode(sha256(convert_to(p_url,'UTF8')),'hex') then raise exception 'Identificator de link invalid.'; end if;
  if length(trim(coalesce(p_title,''))) not between 1 and 300 or length(trim(coalesce(p_lyrics,''))) not between 20 and 100000 then raise exception 'Verifică titlul și versurile.'; end if;
  if jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections) not between 1 and 200 then raise exception 'Secțiuni invalide.'; end if;
  select array_agg(distinct c) into v_collections from unnest(p_collection_ids) c where c is not null;
  if coalesce(cardinality(v_collections),0) not between 1 and 20 then raise exception 'Alege între 1 și 20 de colecții.'; end if;
  if (select count(*) from public.song_collections where id=any(v_collections) and is_active) <> cardinality(v_collections) then raise exception 'Una dintre colecții nu mai este activă.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_source_key,43));
  select song_id into v_mapped from public.song_link_imports where source_key=p_source_key;
  if v_mapped is not null and p_existing_song_id is not null and v_mapped<>p_existing_song_id then raise exception 'Linkul este deja asociat altei cântări. Reîncarcă preview-ul.'; end if;
  v_song:=coalesce(v_mapped,p_existing_song_id);
  if v_song is null then
    select r.song_id into v_song from public.external_song_refs r join public.songs s on s.id=r.song_id
    where s.is_active and 'resursecrestine:'||substring(r.external_url from '/cantece/([0-9]+)')=p_source_key order by r.created_at limit 1;
  end if;
  if v_song is null then
    v_song:=public.import_song_with_sections(v_collections[1],trim(p_title),nullif(trim(p_song_number),''),p_lyrics,p_sections,
      trim(p_title)||'.url','other','Import din link, verificat în preview. Sursa: '||p_url,null,null,p_structure,p_notes,null);
    v_new:=true;
    select id into v_file from public.song_files where song_id=v_song order by created_at desc limit 1;
  else
    perform id from public.songs where id=v_song for update;
    if not exists(select 1 from public.songs where id=v_song and is_active) then raise exception 'Cântarea existentă nu mai este activă.'; end if;
  end if;
  foreach v_collection in array v_collections loop
    if not exists(select 1 from public.song_sources where song_id=v_song and collection_id=v_collection) then
      insert into public.song_sources(song_id,collection_id,song_number,source_title,source_file_id)
      values(v_song,v_collection,nullif(trim(p_song_number),''),(select title from public.songs where id=v_song),v_file);
      v_linked:=v_linked+1;
    end if;
  end loop;
  insert into public.song_link_imports(source_key,source_url,song_id,imported_by) values(p_source_key,p_url,v_song,auth.uid())
  on conflict(source_key) do nothing;
  return jsonb_build_object('songId',v_song,'created',v_new,'collectionsAdded',v_linked+case when v_new then 1 else 0 end);
end $$;

create or replace function public.find_duplicate_song_candidates(p_limit integer default 50)
returns table (
  group_key text,
  title_hint text,
  song_count integer,
  songs jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with normalized as (
    select
      s.id,
      s.title,
      s.default_key,
      s.bpm,
      s.created_at,
      public.normalize_song_title_for_duplicates(s.title) as group_key,
      coalesce(string_agg(distinct c.name, ', ' order by c.name), '') as collections,
      coalesce(string_agg(distinct ss.song_number, ', ' order by ss.song_number) filter (where ss.song_number is not null and ss.song_number <> ''), '') as numbers,
      length(coalesce(s.lyrics_text, '')) as lyrics_length
    from public.songs s
    left join public.song_sources ss on ss.song_id = s.id
    left join public.song_collections c on c.id = ss.collection_id
    where s.is_active
    group by s.id
  ), grouped as (
    select
      n.group_key,
      min(n.title) as title_hint,
      count(*)::integer as song_count,
      jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'title', n.title,
          'default_key', n.default_key,
          'bpm', n.bpm,
          'created_at', n.created_at,
          'collections', n.collections,
          'numbers', n.numbers,
          'lyrics_length', n.lyrics_length
        ) order by n.lyrics_length desc, n.created_at asc
      ) as songs
    from normalized n
    where length(n.group_key) >= 4
    group by n.group_key
    having count(*) > 1
  )
  select g.group_key, g.title_hint, g.song_count, g.songs
  from grouped g
  order by g.song_count desc, g.title_hint asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;


notify pgrst,'reload schema';
commit;


-- FILE: 043_v48_access_audit.sql
begin;
alter table public.profiles alter column is_active set default false;
create table if not exists public.activity_log_v48 (
 id bigint generated always as identity primary key, occurred_at timestamptz not null default now(),
 actor_id uuid, actor_email text, event_type text not null, resource_type text, resource_id text,
 path text, details jsonb not null default '{}', transaction_id bigint not null default txid_current()
);
create index if not exists activity_log_date_v48 on public.activity_log_v48(occurred_at desc,id desc);
create index if not exists activity_log_actor_v48 on public.activity_log_v48(actor_id,occurred_at desc);
alter table public.activity_log_v48 enable row level security;
drop policy if exists activity_admin_read on public.activity_log_v48;
create policy activity_admin_read on public.activity_log_v48 for select to authenticated using(public.is_admin());
revoke all on public.activity_log_v48 from public,anon,authenticated;
grant select on public.activity_log_v48 to authenticated;
grant insert,select on public.activity_log_v48 to service_role;
grant usage,select on sequence public.activity_log_v48_id_seq to service_role;

create or replace function public.audit_write_v48() returns trigger language plpgsql security definer set search_path=public as $$
declare v_old jsonb;v_new jsonb;v_row jsonb;v_fields jsonb;v_before jsonb;v_after jsonb;
begin
 v_old:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 v_new:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 v_row:=case when tg_op='DELETE' then v_old else v_new end;
 select coalesce(jsonb_agg(key order by key),'[]') into v_fields from (select key from jsonb_each(v_old||v_new) where (v_old->key) is distinct from (v_new->key)) x;
 -- Never copy credentials, full lyrics, notes, tokens or share slugs into audit data.
 select coalesce(jsonb_object_agg(key,value),'{}') into v_before from jsonb_each(v_old) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions']);
 select coalesce(jsonb_object_agg(key,value),'{}') into v_after from jsonb_each(v_new) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions']);
 insert into public.activity_log_v48(actor_id,actor_email,event_type,resource_type,resource_id,details)
 values(auth.uid(),(select email from public.profiles where id=auth.uid()),lower(tg_op),tg_table_name,coalesce(v_row->>'id',v_row->>'song_id',v_row->>'source_key'),jsonb_build_object('fields',v_fields,'before',v_before,'after',v_after));
 return null;
end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','songs','song_sections','song_sources','song_files','song_collections','categories','song_categories','meetings','meeting_items','meeting_share_links','song_bible_references','public_meeting_contributions','external_sources','external_song_refs','external_sync_runs','song_link_imports','youth_key_applied_v46','song_merge_history_v47'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop trigger if exists audit_write_v48 on public.%I',t);
   execute format('create trigger audit_write_v48 after insert or update or delete on public.%I for each row execute function public.audit_write_v48()',t);
  end if;
 end loop;
end $$;
create or replace function public.guard_last_admin_v48() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.role='admin' and old.is_active and (tg_op='DELETE' or new.role<>'admin' or not new.is_active) then
  perform pg_advisory_xact_lock(hashtextextended('songapp-active-admins',48));
  if not exists(select 1 from public.profiles where id<>old.id and role='admin' and is_active) then raise exception 'Trebuie să rămână cel puțin un administrator activ.'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
drop trigger if exists guard_last_admin_v48 on public.profiles;
create trigger guard_last_admin_v48 before update or delete on public.profiles for each row execute function public.guard_last_admin_v48();
create or replace function public.new_account_pending_v48() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,email,full_name,role,is_active)
 values(new.id,new.email,left(to_jsonb(new)->'raw_user_meta_data'->>'full_name',120),'viewer',false) on conflict(id) do nothing;
 return new;
end $$;
drop trigger if exists songapp_pending_profile_v48 on auth.users;
create trigger songapp_pending_profile_v48 after insert on auth.users for each row execute function public.new_account_pending_v48();
insert into public.profiles(id,email,role,is_active) select id,email,'viewer',false from auth.users on conflict(id) do nothing;
create or replace function public.admin_set_profile_v48(p_id uuid,p_role text,p_active boolean) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Doar administratorii pot gestiona conturile.' using errcode='42501'; end if;
 if p_role not in ('admin','editor','worship_leader','viewer') or p_active is null then raise exception 'Rol invalid.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('songapp-active-admins',48));
 update public.profiles set role=p_role::public.app_role,is_active=p_active where id=p_id;
 if not found then raise exception 'Contul nu mai există.'; end if;
 return true;
end $$;
revoke all on function public.admin_set_profile_v48(uuid,text,boolean) from public,anon;
grant execute on function public.admin_set_profile_v48(uuid,text,boolean) to authenticated;
create or replace function public.record_activity_v48(p_event text,p_path text default null,p_details jsonb default '{}') returns boolean language plpgsql security definer set search_path=public as $$
begin
 if public.current_user_role() is null then raise exception 'Acces inactiv.' using errcode='42501'; end if;
 if p_event not in ('auth.login','auth.logout','account.password','request.view','request.action','program.print','song.present','import.preview','search') then raise exception 'Eveniment invalid.'; end if;
 insert into public.activity_log_v48(actor_id,actor_email,event_type,path,details)
 values(auth.uid(),(select email from public.profiles where id=auth.uid()),p_event,left(split_part(p_path,'?',1),500),
 jsonb_strip_nulls(jsonb_build_object('query',left(p_details->>'query',300),'source_host',left(p_details->>'source_host',200),'count',p_details->>'count','format',left(p_details->>'format',40))));
 return true;
end $$;
revoke all on function public.record_activity_v48(text,text,jsonb) from public,anon;
grant execute on function public.record_activity_v48(text,text,jsonb) to authenticated;
create or replace function public.record_auth_failure_v48(p_event text,p_email text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Acces interzis.' using errcode='42501'; end if;
 if p_event not in ('auth.failure','auth.denied','admin.create_failure') then raise exception 'Eveniment invalid.'; end if;
 insert into public.activity_log_v48(event_type,actor_email) values(p_event,left(p_email,320));return true;
end $$;
revoke all on function public.record_auth_failure_v48(text,text) from public,anon,authenticated;
grant execute on function public.record_auth_failure_v48(text,text) to service_role;
create or replace function public.record_public_view_v48(p_slug text,p_event text default 'public.view') returns boolean language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if p_event not in ('public.view','public.print') then raise exception 'Eveniment invalid.'; end if;
 select meeting_id into v_id from public.meeting_share_links where public_slug=p_slug and is_active and (expires_at is null or expires_at>now());
 if v_id is null then return false; end if;
 insert into public.activity_log_v48(event_type,resource_type,resource_id,path) values(p_event,'meetings',v_id::text,'/program/[shared]');return true;
end $$;
revoke all on function public.record_public_view_v48(text,text) from public;
grant execute on function public.record_public_view_v48(text,text) to anon,authenticated;
create table if not exists public.runtime_health_v48(id integer primary key check(id=1),status text not null);
insert into public.runtime_health_v48 values(1,'ready') on conflict(id) do nothing;
alter table public.runtime_health_v48 enable row level security;
revoke all on public.runtime_health_v48 from public,anon,authenticated;
create or replace function public.songapp_health_v48() returns boolean language sql stable security definer set search_path=public as $$ select status='ready' from public.runtime_health_v48 where id=1 $$;
revoke all on function public.songapp_health_v48() from public;
grant execute on function public.songapp_health_v48() to anon,authenticated;
alter table public.meeting_share_links add column if not exists allow_contributions boolean not null default false;

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

create or replace function public.public_search_songs_for_share(
  p_public_slug text,
  search_query text,
  result_limit integer default 20
)
returns table (
  song_id uuid,
  title text,
  default_key text,
  bpm integer,
  matched_source text,
  lyrics_text text
)
language sql
stable
security definer
set search_path = public
as $$
  with active_link as (
    select l.id
    from public.meeting_share_links l
    where l.public_slug = p_public_slug
      and l.is_active = true and l.allow_contributions
      and (l.expires_at is null or l.expires_at > now())
    limit 1
  ), q as (
    select
      trim(coalesce(search_query, '')) as raw_term,
      lower(public.unaccent(trim(coalesce(search_query, '')))) as term,
      regexp_replace(lower(public.unaccent(trim(coalesce(search_query, '')))), '^nr\.?\s*', '', 'i') as number_term
  ), matches as (
    select
      s.id as song_id,
      s.title,
      s.default_key,
      s.bpm,
      s.lyrics_text,
      string_agg(distinct coalesce(sc.short_code || ' nr. ' || ss.song_number, sc.short_code, ss.source_title), ', ') as matched_source,
      greatest(
        case when lower(public.unaccent(s.title)) = q.term then 1.0 else 0.0 end,
        case when lower(public.unaccent(s.title)) like '%' || q.term || '%' then 0.85 else 0.0 end,
        case when s.search_text like '%' || q.term || '%' then 0.75 else 0.0 end,
        coalesce(similarity(s.search_text, q.term), 0),
        case when exists (
          select 1
          from public.song_sources ss2
          where ss2.song_id = s.id
            and (
              lower(public.unaccent(coalesce(ss2.song_number, ''))) like '%' || q.number_term || '%'
              or lower(public.unaccent(coalesce(ss2.source_title, ''))) like '%' || q.term || '%'
            )
        ) then 0.95 else 0.0 end
      )::real as rank
    from active_link
    cross join q
    join public.songs s on s.is_active = true
    left join public.song_sources ss on ss.song_id = s.id
    left join public.song_collections sc on sc.id = ss.collection_id
    where length(q.term) >= 2
      and (
        s.search_text like '%' || q.term || '%'
        or lower(public.unaccent(s.title)) like '%' || q.term || '%'
        or exists (
          select 1
          from public.song_sources ss3
          where ss3.song_id = s.id
            and (
              lower(public.unaccent(coalesce(ss3.song_number, ''))) like '%' || q.number_term || '%'
              or lower(public.unaccent(coalesce(ss3.source_title, ''))) like '%' || q.term || '%'
            )
        )
      )
    group by s.id, s.title, s.default_key, s.bpm, s.lyrics_text, s.search_text, q.term, q.number_term
  )
  select m.song_id, m.title, m.default_key, m.bpm, m.matched_source, m.lyrics_text
  from matches m
  order by m.rank desc, m.title asc
  limit least(greatest(result_limit, 1), 30);
$$;

create or replace function public.add_public_meeting_contribution(
  p_public_slug text,
  p_contribution_type text default 'song',
  p_song_id uuid default null,
  p_custom_title text default null,
  p_custom_text text default null,
  p_is_backup boolean default false,
  p_proposed_position integer default null,
  p_contributor_name text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
  v_id uuid;
  v_position integer;
begin
  select l.id as share_link_id, l.meeting_id
  into v_link
  from public.meeting_share_links l
  where l.public_slug = p_public_slug
    and l.is_active = true and l.allow_contributions
    and (l.expires_at is null or l.expires_at > now())
  limit 1;

  if v_link.share_link_id is null then
    raise exception 'Linkul public nu este activ.';
  end if;

  p_contribution_type := coalesce(nullif(p_contribution_type, ''), 'song');
  if p_contribution_type not in ('song','text','prayer','encouragement','message','break') then
    raise exception 'Tip de contribuție invalid.';
  end if;

  if p_song_id is null and coalesce(trim(p_custom_title), '') = '' and coalesce(trim(p_custom_text), '') = '' then
    raise exception 'Adaugă o cântare sau completează un text.';
  end if;

  if p_song_id is not null and not exists (select 1 from public.songs s where s.id = p_song_id and s.is_active = true) then
    raise exception 'Cântarea selectată nu există.';
  end if;

  if p_proposed_position is not null then
    v_position := greatest(1, least(p_proposed_position, 999));
  else
    v_position := null;
  end if;

  insert into public.public_meeting_contributions (
    meeting_id,
    share_link_id,
    contribution_type,
    song_id,
    custom_title,
    custom_text,
    is_backup,
    proposed_position,
    contributor_name,
    notes,
    status
  ) values (
    v_link.meeting_id,
    v_link.share_link_id,
    p_contribution_type,
    p_song_id,
    nullif(left(trim(coalesce(p_custom_title, '')), 180), ''),
    nullif(left(trim(coalesce(p_custom_text, '')), 4000), ''),
    coalesce(p_is_backup, false),
    v_position,
    nullif(left(trim(coalesce(p_contributor_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_notes, '')), 1000), ''),
    'pending'
  ) returning id into v_id;

  return v_id;
end;
$$;
notify pgrst,'reload schema';
commit;


-- FILE: 044_v49_program_creation_search.sql
begin;
-- A receipt is scoped to the signed-in author. Repeating a request returns its original program.
create table if not exists public.meeting_create_requests_v49(
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 meeting_id uuid not null references public.meetings(id) on delete cascade,
 primary key(user_id,request_id)
);
alter table public.meeting_create_requests_v49 enable row level security;
revoke all on public.meeting_create_requests_v49 from public,anon,authenticated;
create or replace function public.create_meeting_once_v49(p_request_id uuid,p_title text,p_meeting_type text,p_meeting_date timestamptz,p_notes text default null,p_song_id uuid default null,p_is_backup boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
 if p_request_id is null or length(trim(coalesce(p_title,''))) not between 1 and 200 or p_meeting_date is null or not isfinite(p_meeting_date) then raise exception 'Titlul și data sunt obligatorii.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,49));
 select meeting_id into v_id from public.meeting_create_requests_v49 where user_id=auth.uid() and request_id=p_request_id;
 if v_id is not null then return v_id; end if;
 v_id:=public.create_meeting(trim(p_title),p_meeting_type,p_meeting_date,p_notes);
 if p_song_id is not null then perform public.add_song_to_meeting(v_id,p_song_id,coalesce(p_is_backup,false),null,null); end if;
 insert into public.meeting_create_requests_v49 values(auth.uid(),p_request_id,v_id);
 return v_id;
end $$;
revoke all on function public.create_meeting_once_v49(uuid,text,text,timestamptz,text,uuid,boolean) from public,anon;
grant execute on function public.create_meeting_once_v49(uuid,text,text,timestamptz,text,uuid,boolean) to authenticated;

-- Fixed unaccent dictionary used by the search expression indexes.
create or replace function public.search_fold_v49(value text) returns text language sql immutable parallel safe set search_path=public as $$ select lower(public.unaccent(coalesce(value,''))) $$;
create index if not exists songs_title_search_v49 on public.songs using gin(public.search_fold_v49(title) gin_trgm_ops) where is_active;
create index if not exists source_title_search_v49 on public.song_sources using gin(public.search_fold_v49(source_title) gin_trgm_ops);
create index if not exists source_number_search_v49 on public.song_sources (public.search_fold_v49(song_number) text_pattern_ops);

create or replace function public.search_program_songs_v49(p_query text,p_limit integer default 8)
returns table(song_id uuid,title text,default_key text,bpm integer,rank real,matched_source text)
language plpgsql security definer set search_path=public as $$
declare term text;pattern text;number_term text;
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501'; end if;
 term:=public.search_fold_v49(left(trim(coalesce(p_query,'')),160));
 if length(term)<2 and term!~'^[0-9]$' then return; end if;
 pattern:='%'||replace(replace(replace(term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 number_term:=regexp_replace(term,'^nr\.?\s*','');
 perform public.record_activity_v48('search','/api/songs/search',jsonb_build_object('query',term));
 return query
 with title_matches as materialized (
  select s.id,case when public.search_fold_v49(s.title)=term then 0 when public.search_fold_v49(s.title) like substr(pattern,2) then 1 else 2 end priority
  from public.songs s where s.is_active and public.search_fold_v49(s.title) like pattern
  order by priority,s.title,s.id limit 80
 ), source_matches as materialized (
  select s.id,case when public.search_fold_v49(ss.song_number)=number_term then 0 else 3 end priority
  from public.song_sources ss join public.songs s on s.id=ss.song_id and s.is_active
  where public.search_fold_v49(ss.song_number) like replace(replace(replace(number_term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%'
    or public.search_fold_v49(ss.source_title) like pattern
  order by priority,s.title,s.id limit 80
 ), lyric_matches as materialized (
  select s.id,4 priority from public.songs s where s.is_active and length(term)>=2 and (s.search_vector @@ plainto_tsquery('simple',term) or s.search_text like pattern)
  order by s.title,s.id limit 80
 ), chosen as (
  select s.id,s.title,s.default_key,s.bpm,min(c.priority) priority from (select * from title_matches union all select * from source_matches union all select * from lyric_matches)c join public.songs s on s.id=c.id
  group by s.id order by min(c.priority),s.title,s.id limit least(greatest(coalesce(p_limit,8),1),30)
 )
 select c.id,c.title,c.default_key,c.bpm,(5-c.priority)::real,
  (select string_agg(distinct coalesce(sc.short_code,sc.name)||case when ss.song_number is not null then ' nr. '||ss.song_number else '' end,', ')
   from public.song_sources ss join public.song_collections sc on sc.id=ss.collection_id where ss.song_id=c.id)
 from chosen c order by c.priority,c.title,c.id;
end $$;
revoke all on function public.search_program_songs_v49(text,integer) from public,anon;
grant execute on function public.search_program_songs_v49(text,integer) to authenticated;
notify pgrst,'reload schema';
commit;


-- FILE: 045_v52_collections_planning.sql
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


-- FILE: 046_v53_program_ui.sql
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


-- FILE: 047_v54_program_notifications.sql
begin;
-- Use the same per-meeting lock and global ordering as drag/drop. The legacy
-- per-group position shift collided with the other list's unique positions.
create or replace function public.accept_public_meeting_contribution(p_contribution_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.public_meeting_contributions; mid uuid; result uuid; before_id uuid; note text;
begin
 if not public.can_edit_content() then raise exception 'Nu ai permisiunea să accepți propuneri.' using errcode='42501';end if;
 select meeting_id into mid from public.public_meeting_contributions where id=p_contribution_id;
 if mid is null then raise exception 'Propunerea nu există.';end if;
 perform 1 from public.meetings where id=mid for update;
 select * into c from public.public_meeting_contributions where id=p_contribution_id for update;
 if not found then raise exception 'Propunerea nu mai există.';end if;
 if c.status<>'pending' then raise exception 'Propunerea a fost deja procesată.';end if;
 if c.proposed_position is not null then
  select id into before_id from public.meeting_items where meeting_id=mid and is_backup=c.is_backup order by position,id offset greatest(c.proposed_position-1,0) limit 1;
 end if;
 note:=concat_ws(E'\n',nullif(c.notes,''),'Adăugată din link public'||case when nullif(c.contributor_name,'') is not null then ' de '||c.contributor_name else '' end);
 if c.song_id is not null then
  if not exists(select 1 from public.songs where id=c.song_id and is_active) then raise exception 'Cântarea propusă nu mai este disponibilă.';end if;
  result:=public.add_song_to_meeting(mid,c.song_id,c.is_backup,null,note);
 else
  if c.contribution_type='song' then raise exception 'Cântarea propusă nu mai este disponibilă.';end if;
  result:=public.add_text_to_meeting(mid,c.contribution_type,c.custom_title,c.custom_text);
  update public.meeting_items set notes=nullif(note,'') where id=result;
 end if;
 perform public.place_meeting_item_v45(mid,result,c.is_backup,before_id);
 update public.public_meeting_contributions set status='accepted',reviewed_at=now(),reviewed_by=auth.uid() where id=c.id;
 return result;
end $$;
revoke all on function public.accept_public_meeting_contribution(uuid) from public,anon;
grant execute on function public.accept_public_meeting_contribution(uuid) to authenticated;

create or replace function public.program_notifications_v54(p_meeting_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if not exists(select 1 from public.meetings where id=p_meeting_id) then raise exception 'Program inexistent.' using errcode='P0002';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'contribution_type',c.contribution_type,'custom_title',c.custom_title,'custom_text',c.custom_text,'is_backup',c.is_backup,'proposed_position',c.proposed_position,'contributor_name',c.contributor_name,'notes',c.notes,'created_at',c.created_at,'songs',case when s.id is null then null else jsonb_build_object('id',s.id,'title',s.title,'default_key',s.default_key) end) order by c.created_at,c.id),'[]'::jsonb)
 into result from public.public_meeting_contributions c left join public.songs s on s.id=c.song_id where c.meeting_id=p_meeting_id and c.status='pending';
 return result;
end $$;
revoke all on function public.program_notifications_v54(uuid) from public,anon;
grant execute on function public.program_notifications_v54(uuid) to authenticated;

-- One request for mutation + confirmed state. Avoid re-rendering the entire
-- detail page (history/share/usage queries) before the browser can see a change.
create or replace function public.set_program_common_v54(p_meeting_id uuid,p_item_id uuid,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_enabled is null then raise exception 'Marcaj invalid.';end if;
 perform 1 from public.meetings where id=p_meeting_id for update;
 update public.meeting_items set is_congregational=p_enabled where id=p_item_id and meeting_id=p_meeting_id and song_id is not null;
 if not found then raise exception 'Cântarea nu mai există în acest program.' using errcode='P0002';end if;
 return public.get_meeting_snapshot_v46(p_meeting_id);
end $$;
revoke all on function public.set_program_common_v54(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_program_common_v54(uuid,uuid,boolean) to authenticated;

create or replace function public.review_program_contribution_v54(p_meeting_id uuid,p_contribution_id uuid,p_accept boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.public_meeting_contributions;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_accept is null then raise exception 'Acțiune invalidă.';end if;
 perform 1 from public.meetings where id=p_meeting_id for update;
 select * into c from public.public_meeting_contributions where id=p_contribution_id and meeting_id=p_meeting_id for update;
 if not found then raise exception 'Propunerea nu mai există în acest program.' using errcode='P0002';end if;
 -- Retried requests never insert a duplicate or reverse a prior decision.
 if c.status='pending' then
  if p_accept then perform public.accept_public_meeting_contribution(c.id);
  else perform public.reject_public_meeting_contribution(c.id);end if;
 end if;
 return jsonb_build_object('snapshot',public.get_meeting_snapshot_v46(p_meeting_id),'pending',public.program_notifications_v54(p_meeting_id));
end $$;
revoke all on function public.review_program_contribution_v54(uuid,uuid,boolean) from public,anon;
grant execute on function public.review_program_contribution_v54(uuid,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;


-- FILE: 048_v55_red_book_import.sql
begin;
create index if not exists songs_import_title_v55 on public.songs(public.normalize_song_title_for_duplicates(title)) where is_active;
create or replace function public.red_book_collection_v55() returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; matches uuid[];
begin
 if not (coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('songapp-red-book-v55',0));
 select array_agg(id) into matches from public.song_collections where name='Cartea roșie - Cântările Evangheliei';
 if cardinality(matches)>1 then raise exception 'Există mai multe colecții cu numele destinației. Unifică-le înainte de import.';end if;
 if cardinality(matches)=1 then cid:=matches[1];end if;
 if cid is null then
  select array_agg(id) into matches from public.song_collections where public.normalize_song_title_for_duplicates(name) in ('cartearosiecantarileevangheliei','carterosiecantarileevangheliei','cantarileevanghelieicarterosie','cantarileevanghelieicartearosie');
  if cardinality(matches)>1 then raise exception 'Există mai multe colecții Carte roșie. Păstrează numele exact Cartea roșie - Cântările Evangheliei pentru destinația dorită.';end if;
  if cardinality(matches)=1 then cid:=matches[1];end if;
 end if;
 if cid is null then
  insert into public.song_collections(name,short_code,source_type,is_active,color) values('Cartea roșie - Cântările Evangheliei',case when exists(select 1 from public.song_collections where short_code='CR') then 'CR_IMPORT_V55' else 'CR' end,'ppt',true,'#b91c1c') returning id into cid;
 end if;
 return (select jsonb_build_object('id',id,'name',name,'color',color) from public.song_collections where id=cid);
end $$;
revoke all on function public.red_book_collection_v55() from public,anon;
grant execute on function public.red_book_collection_v55() to authenticated,service_role;

create or replace function public.import_red_book_song_v55(p_title text,p_number text,p_lyrics text,p_sections jsonb,p_source_ids jsonb,p_url text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; sid uuid; candidates uuid[]; linked_ids uuid[]; source_row public.song_sources; old_lyrics text; result text:='existing'; source_id text; section jsonb; section_count integer; filled boolean:=false;
begin
 if not (coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if length(trim(coalesce(p_title,''))) not between 1 and 300 or p_number is null or p_number !~ '^[0-9]{1,4}$' or p_number::integer not between 1 and 9999 then raise exception 'Titlu/număr invalid.';end if;
 if p_url is null or p_url !~ '^https://(www\.)?cantaricrestine\.ro/[^?#]+$' then raise exception 'Sursă invalidă.';end if;
 if jsonb_typeof(p_source_ids) is distinct from 'array' or jsonb_array_length(p_source_ids) not between 1 and 10 then raise exception 'ID sursă invalid.';end if;
 for source_id in select jsonb_array_elements_text(p_source_ids) loop if source_id !~ '^[0-9]{1,20}$' then raise exception 'ID sursă invalid.';end if;end loop;
 if jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections)>300 or length(coalesce(p_lyrics,''))>100000 then raise exception 'Versuri/structură invalidă.';end if;
 perform pg_advisory_xact_lock(hashtextextended('songapp-red-book-v55',0));
 cid:=(public.red_book_collection_v55()->>'id')::uuid;
 -- Source identity takes precedence over title; conflicting mappings need human review.
 select array_agg(distinct song_id) into linked_ids from public.song_link_imports where source_key in (select 'cantaricrestine:cr:'||jsonb_array_elements_text(p_source_ids));
 if cardinality(linked_ids)>1 then return jsonb_build_object('status','review','reason','ID-urile sursă sunt deja legate de cântări diferite.');end if;
 if cardinality(linked_ids)=1 then sid:=linked_ids[1];end if;
 -- Number alone never merges different titles.
 select array_agg(distinct ss.song_id) into candidates from public.song_sources ss where ss.collection_id=cid and ss.song_number ~ '^[0-9]+$' and ltrim(ss.song_number,'0')=ltrim(p_number,'0');
 if cardinality(candidates)>1 or (cardinality(candidates)=1 and sid is not null and sid<>candidates[1]) then return jsonb_build_object('status','review','reason','Numărul este deja asociat unor cântări diferite.');end if;
 if cardinality(candidates)=1 and sid is null then
  if public.normalize_song_title_for_duplicates((select title from public.songs where id=candidates[1]))<>public.normalize_song_title_for_duplicates(p_title) then return jsonb_build_object('status','review','reason','Numărul există cu alt titlu; datele existente au fost păstrate.');end if;
  sid:=candidates[1];
 end if;
 if sid is null then
  select array_agg(id) into candidates from public.songs where is_active and public.normalize_song_title_for_duplicates(title)=public.normalize_song_title_for_duplicates(p_title);
  if cardinality(candidates)>1 then return jsonb_build_object('status','review','reason','Mai multe cântări existente au același titlu.');end if;
  if cardinality(candidates)=1 then
   sid:=candidates[1];
   -- The book itself has distinct numbered songs with identical titles (019/044).
   -- Only distinguish automatically when the prior song was mapped by this importer,
   -- has a different book number AND different nonempty lyrics. Never renumber it.
   if exists(select 1 from public.song_link_imports where song_id=sid and source_key like 'cantaricrestine:cr:%')
    and exists(select 1 from public.song_sources where song_id=sid and collection_id=cid and song_number ~ '^[0-9]+$' and ltrim(song_number,'0')<>ltrim(p_number,'0'))
    and length(trim(coalesce(p_lyrics,'')))>=20
    and exists(select 1 from public.songs where id=sid and nullif(trim(lyrics_text),'') is not null and public.normalize_song_title_for_duplicates(lyrics_text)<>public.normalize_song_title_for_duplicates(p_lyrics)) then sid:=null;end if;
  end if;
 end if;
 if sid is not null then
  if not exists(select 1 from public.songs where id=sid and is_active) then return jsonb_build_object('status','review','reason','Cântarea existentă este inactivă.');end if;
  select * into source_row from public.song_sources where collection_id=cid and song_id=sid order by created_at,id limit 1;
  if found and nullif(trim(source_row.song_number),'') is not null and (source_row.song_number !~ '^[0-9]+$' or ltrim(source_row.song_number,'0')<>ltrim(p_number,'0')) then return jsonb_build_object('status','review','reason','Cântarea existentă are alt număr în colecție.');end if;
 end if;
 if sid is null then
  if length(trim(coalesce(p_lyrics,'')))<20 or jsonb_array_length(p_sections)=0 then return jsonb_build_object('status','review','reason','Versuri lipsă sau nerecuperate sigur din PowerPoint.');end if;
  insert into public.songs(title,lyrics_text) values(trim(p_title),trim(p_lyrics)) returning id into sid;result:='created';filled:=true;
 else
  select lyrics_text into old_lyrics from public.songs where id=sid for update;
  if nullif(trim(old_lyrics),'') is null and length(trim(coalesce(p_lyrics,'')))>=20 and jsonb_array_length(p_sections)>0 then update public.songs set lyrics_text=trim(p_lyrics) where id=sid;filled:=true;result:='filled';end if;
 end if;
 -- Existing nonempty lyrics, keys, notes and sections are never overwritten.
 if filled and not exists(select 1 from public.song_sections where song_id=sid) then
  section_count:=0;
  for section in select value from jsonb_array_elements(p_sections) loop
   if length(trim(coalesce(section->>'content','')))=0 then continue;end if;section_count:=section_count+1;
   insert into public.song_sections(song_id,section_type,section_label,position,content) values(sid,case when section->>'section_type' in ('verse','chorus','bridge','intro','outro','prechorus','ending','other') then section->>'section_type' else 'verse' end,section->>'section_label',section_count,section->>'content');
  end loop;
 end if;
 if source_row.id is null then
  insert into public.song_sources(song_id,collection_id,song_number,source_title) values(sid,cid,p_number,'cantaricrestine.ro · cr');if result='existing' then result:='linked';end if;
 elsif nullif(trim(source_row.song_number),'') is null then update public.song_sources set song_number=p_number where id=source_row.id;if result='existing' then result:='linked';end if;end if;
 for source_id in select jsonb_array_elements_text(p_source_ids) loop
  insert into public.song_link_imports(source_key,source_url,song_id,imported_by) values('cantaricrestine:cr:'||source_id,p_url,sid,auth.uid()) on conflict(source_key) do nothing;
 end loop;
 return jsonb_build_object('status',result,'songId',sid,'collectionId',cid,'number',p_number);
end $$;
revoke all on function public.import_red_book_song_v55(text,text,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.import_red_book_song_v55(text,text,text,jsonb,jsonb,text) to authenticated,service_role;
notify pgrst,'reload schema';
commit;


-- FILE: 049_v56_library_activity.sql
begin;
create or replace function public.collection_song_counts_v56() returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from (
 select sc.id as collection_id,count(distinct s.id) filter(where s.is_active) as song_count from public.song_collections sc left join public.song_sources ss on ss.collection_id=sc.id left join public.songs s on s.id=ss.song_id where public.current_user_role() is not null group by sc.id
 ) c;
$$;
revoke all on function public.collection_song_counts_v56() from public,anon;
grant execute on function public.collection_song_counts_v56() to authenticated;
create or replace function public.list_song_library_v46(
  p_collection uuid default null, p_category uuid default null, p_number text default null,
  p_status text default null, p_key text default null, p_sort text default 'title_asc',
  p_page integer default 1, p_page_size integer default 50, p_query text default null
) returns jsonb language sql stable security invoker set search_path = public as $$
with usage as materialized (
  select song_id,count(*) as times_sung,max(meeting_date) as last_used_at
  from public.song_performance_occurrences_v46 group by song_id
), filtered as materialized (
  select s.id,s.title,s.default_key,s.bpm,s.structure,s.created_at,coalesce(u.times_sung,0) as times_sung,u.last_used_at,
    (select min(nullif(regexp_replace(src.song_number,'[^0-9]','','g'),'')::numeric)
       from public.song_sources src where src.song_id=s.id
       and (p_collection is null or src.collection_id=p_collection)) as source_number
  from public.songs s left join usage u on u.song_id=s.id
  where s.is_active
    and (p_sort not in ('most_sung','last_sung') or coalesce(u.times_sung,0)>0)
    and (nullif(trim(p_query),'') is null
      or s.search_vector @@ plainto_tsquery('simple',public.unaccent(p_query))
      or s.search_text ilike '%'||lower(public.unaccent(p_query))||'%'
      or exists(select 1 from public.song_sources ss where ss.song_id=s.id and
        (ss.song_number ilike '%'||p_query||'%' or lower(public.unaccent(coalesce(ss.source_title,''))) ilike '%'||lower(public.unaccent(p_query))||'%')))
    and (p_key is null or s.default_key=p_key)
    and (p_collection is null or exists(select 1 from public.song_sources src where src.song_id=s.id and src.collection_id=p_collection))
    and (p_category is null or exists(select 1 from public.song_categories c where c.song_id=s.id and c.category_id=p_category))
    and (nullif(trim(p_number),'') is null or exists(select 1 from public.song_sources src where src.song_id=s.id and (src.song_number ilike '%'||p_number||'%' or src.source_title ilike '%'||p_number||'%')))
    and (p_status is null or exists(select 1 from public.song_files f where f.song_id=s.id and f.import_status::text=p_status))
), paged as (
  select * from filtered
  order by
    case when p_sort='most_sung' then times_sung end desc nulls last,
    case when p_sort in ('most_sung','last_sung') then last_used_at end desc nulls last,
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
revoke all on function public.list_song_library_v46(uuid,uuid,text,text,text,text,integer,integer,text) from public,anon;
grant execute on function public.list_song_library_v46(uuid,uuid,text,text,text,text,integer,integer,text) to authenticated;

create or replace function public.activity_resource_label_v56(kind text,rid text) returns text language plpgsql stable security invoker set search_path=public as $$
declare uid uuid; label text;
begin
 if rid is null or rid !~ '^[0-9a-fA-F-]{36}$' then return null;end if;
 begin uid:=rid::uuid;exception when invalid_text_representation then return null;end;
 case kind
 when 'songs' then select title into label from public.songs where id=uid;
 when 'meetings' then select title into label from public.meetings where id=uid;
 when 'song_collections' then select name into label from public.song_collections where id=uid;
 when 'categories' then select name into label from public.categories where id=uid;
 when 'profiles' then select coalesce(full_name,email) into label from public.profiles where id=uid;
 when 'meeting_items' then select coalesce(s.title,i.custom_title,'Moment')||' · '||m.title into label from public.meeting_items i join public.meetings m on m.id=i.meeting_id left join public.songs s on s.id=i.song_id where i.id=uid;
 when 'song_sections' then select s.title into label from public.song_sections x join public.songs s on s.id=x.song_id where x.id=uid;
 when 'song_sources' then select s.title||' · '||c.name into label from public.song_sources x join public.songs s on s.id=x.song_id join public.song_collections c on c.id=x.collection_id where x.id=uid;
 when 'song_files' then select file_name into label from public.song_files where id=uid;
 when 'meeting_share_links' then select m.title into label from public.meeting_share_links x join public.meetings m on m.id=x.meeting_id where x.id=uid;
 when 'public_meeting_contributions' then select coalesce(s.title,x.custom_title,'Propunere')||' · '||m.title into label from public.public_meeting_contributions x join public.meetings m on m.id=x.meeting_id left join public.songs s on s.id=x.song_id where x.id=uid;
 else label:=null;
 end case;
 return label;
end $$;
revoke all on function public.activity_resource_label_v56(text,text) from public,anon;
grant execute on function public.activity_resource_label_v56(text,text) to authenticated;
create or replace function public.audit_write_v48() returns trigger language plpgsql security definer set search_path=public as $$
declare v_old jsonb;v_new jsonb;v_row jsonb;v_fields jsonb;v_before jsonb;v_after jsonb;v_label text;
begin
 v_old:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 v_new:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 v_row:=case when tg_op='DELETE' then v_old else v_new end;
 select coalesce(jsonb_agg(key order by key),'[]') into v_fields from (select key from jsonb_each(v_old||v_new) where (v_old->key) is distinct from (v_new->key)) x;
 -- Never copy credentials, full lyrics, notes, tokens or share slugs into audit data.
 select coalesce(jsonb_object_agg(key,value),'{}') into v_before from jsonb_each(v_old) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions','color','selected_source_id','is_congregational']);
 select coalesce(jsonb_object_agg(key,value),'{}') into v_after from jsonb_each(v_new) where key=any(array['title','name','role','is_active','position','is_backup','selected_key','default_key','song_number','allow_contributions','color','selected_source_id','is_congregational']);
 v_label:=coalesce(v_row->>'title',v_row->>'name',v_row->>'custom_title',public.activity_resource_label_v56(tg_table_name,v_row->>'id'),
  (select title from public.songs where id=nullif(v_row->>'song_id','')::uuid),
  (select title from public.meetings where id=nullif(v_row->>'meeting_id','')::uuid));
 insert into public.activity_log_v48(actor_id,actor_email,event_type,resource_type,resource_id,details)
 values(auth.uid(),(select email from public.profiles where id=auth.uid()),lower(tg_op),tg_table_name,coalesce(v_row->>'id',v_row->>'song_id',v_row->>'source_key'),jsonb_build_object('fields',v_fields,'before',v_before,'after',v_after,'resource_label',v_label));
 return null;
end $$;


create or replace function public.activity_feed_v56(p_page integer default 1,p_group text default 'changes',p_actor text default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'Acces interzis.' using errcode='42501';end if;
 with filtered as materialized (
 select l.* from public.activity_log_v48 l where (nullif(trim(p_actor),'') is null or actor_email=trim(p_actor)) and
 (p_group='all' or p_group='changes' and event_type in ('insert','update','delete') or p_group='access' and (event_type like 'request.%' or event_type like 'public.%') or p_group='auth' and event_type like 'auth.%')
 ), paged as (select * from filtered order by id desc limit 50 offset (greatest(least(coalesce(p_page,1),100000),1)-1)*50)
 select jsonb_build_object('total',(select count(*) from filtered),'entries',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('resource_label',coalesce(p.details->>'resource_label',p.details->'after'->>'title',p.details->'after'->>'name',p.details->'before'->>'title',p.details->'before'->>'name',public.activity_resource_label_v56(p.resource_type,p.resource_id))) order by p.id desc) from paged p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.activity_feed_v56(integer,text,text) from public,anon;
grant execute on function public.activity_feed_v56(integer,text,text) to authenticated;
notify pgrst,'reload schema';
commit;


-- FILE: 050_v57_search_add_ui.sql
begin;
alter table public.song_collections add column if not exists opacity integer not null default 100 check(opacity in (25,50,75,100));
alter table public.meeting_items add column if not exists moment_color text not null default '#d97706' check(moment_color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.meeting_items add column if not exists moment_kind text check(moment_kind in ('song','prayer','message','encouragement','text','break','other'));
alter table public.profiles add column if not exists moderation_state text not null default 'visible' check(moderation_state in ('visible','rejected','hidden'));
create or replace function public.guard_profile_moderation_v57() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.moderation_state is distinct from old.moderation_state and not(coalesce(auth.role()='service_role',false) or coalesce(public.current_user_role()='admin'::public.app_role,false)) then raise exception 'Doar administratorii pot modera conturi.' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_profile_moderation_v57() from public,anon,authenticated;
drop trigger if exists profile_moderation_v57 on public.profiles;
create trigger profile_moderation_v57 before update of moderation_state on public.profiles for each row execute function public.guard_profile_moderation_v57();
create or replace function public.admin_moderate_user_v57(p_id uuid,p_remove boolean default false) returns void language plpgsql security definer set search_path=public as $$
declare target public.profiles;
begin
 if public.current_user_role() is distinct from 'admin'::public.app_role or p_id=auth.uid() then raise exception 'Acces interzis.' using errcode='42501';end if;
 select * into target from public.profiles where id=p_id for update;
 if not found or target.is_active then raise exception 'Se pot respinge/elimina numai conturi inactive.';end if;
 update public.profiles set is_active=false,moderation_state=case when p_remove then 'hidden' else 'rejected' end where id=p_id;
end $$;
revoke all on function public.admin_moderate_user_v57(uuid,boolean) from public,anon;
grant execute on function public.admin_moderate_user_v57(uuid,boolean) to authenticated;
create or replace function public.add_moment_v57(p_meeting_id uuid,p_item_type text,p_custom_title text,p_custom_text text,p_color text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_item_type not in ('song','prayer','message','encouragement','text','break','other') or p_color is null or p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Moment invalid.';end if;
 v_id:=public.add_text_to_meeting(p_meeting_id,case when p_item_type='other' then 'text' else p_item_type end,coalesce(nullif(trim(p_custom_title),''),case when p_item_type='other' then 'Diverse' when p_item_type='song' then 'Cântare' else null end),p_custom_text);
 update public.meeting_items set moment_color=p_color,moment_kind=p_item_type where meeting_items.id=v_id;
 return v_id;
end $$;
revoke all on function public.add_moment_v57(uuid,text,text,text,text) from public,anon;
grant execute on function public.add_moment_v57(uuid,text,text,text,text) to authenticated;
create or replace function public.song_number_fold_v57(value text) returns text language sql immutable parallel safe set search_path=public as $$
 select case when v ~ '^[0-9]+[a-z]?$' then coalesce(nullif(regexp_replace(v,'^0+',''),''),'0') else v end from (select regexp_replace(lower(trim(coalesce(value,''))),'^nr\.?\s*','') v) x;
$$;
revoke all on function public.song_number_fold_v57(text) from public,anon;
grant execute on function public.song_number_fold_v57(text) to authenticated;
create index if not exists source_number_fold_v57 on public.song_sources(public.song_number_fold_v57(song_number));
create or replace function public.song_sources_v52(p_song_id uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('source_id',ss.id,'collection_id',c.id,'name',c.name,'short_code',c.short_code,'color',c.color,'opacity',c.opacity,'number',ss.song_number,'is_active',c.is_active) order by c.is_active desc,c.name,ss.song_number,ss.id),'[]'::jsonb)
 from public.song_sources ss join public.song_collections c on c.id=ss.collection_id where ss.song_id=p_song_id;
$$;
revoke all on function public.song_sources_v52(uuid) from public,anon;
grant execute on function public.song_sources_v52(uuid) to authenticated;
drop trigger if exists touch_collection_programs_v52 on public.song_collections;
create trigger touch_collection_programs_v52 after update of color,name,short_code,opacity on public.song_collections for each row when(old.color is distinct from new.color or old.name is distinct from new.name or old.short_code is distinct from new.short_code or old.opacity is distinct from new.opacity) execute function public.touch_collection_programs_v52();
create or replace function public.list_song_library_v46(
  p_collection uuid default null, p_category uuid default null, p_number text default null,
  p_status text default null, p_key text default null, p_sort text default 'title_asc',
  p_page integer default 1, p_page_size integer default 50, p_query text default null
) returns jsonb language sql stable security invoker set search_path = public as $$
with usage as materialized (
  select song_id,count(*) as times_sung,max(meeting_date) as last_used_at
  from public.song_performance_occurrences_v46 group by song_id
), filtered as materialized (
  select s.id,s.title,s.default_key,s.bpm,s.structure,s.created_at,coalesce(u.times_sung,0) as times_sung,u.last_used_at,
    (select min(nullif(regexp_replace(src.song_number,'[^0-9]','','g'),'')::numeric)
       from public.song_sources src where src.song_id=s.id
       and (p_collection is null or src.collection_id=p_collection)) as source_number
  from public.songs s left join usage u on u.song_id=s.id
  where s.is_active
    and (p_sort not in ('most_sung','last_sung') or coalesce(u.times_sung,0)>0)
    and (nullif(trim(p_query),'') is null
      or s.search_vector @@ plainto_tsquery('simple',public.unaccent(p_query))
      or s.search_text ilike '%'||lower(public.unaccent(p_query))||'%'
      or exists(select 1 from public.song_sources ss where ss.song_id=s.id and
        (public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(p_query) or ss.song_number ilike '%'||p_query||'%' or lower(public.unaccent(coalesce(ss.source_title,''))) ilike '%'||lower(public.unaccent(p_query))||'%')))
    and (p_key is null or s.default_key=p_key)
    and (p_collection is null or exists(select 1 from public.song_sources src where src.song_id=s.id and src.collection_id=p_collection))
    and (p_category is null or exists(select 1 from public.song_categories c where c.song_id=s.id and c.category_id=p_category))
    and (nullif(trim(p_number),'') is null or exists(select 1 from public.song_sources src where src.song_id=s.id and (public.song_number_fold_v57(src.song_number)=public.song_number_fold_v57(p_number) or src.song_number ilike '%'||p_number||'%' or src.source_title ilike '%'||p_number||'%')))
    and (p_status is null or exists(select 1 from public.song_files f where f.song_id=s.id and f.import_status::text=p_status))
), paged as (
  select * from filtered
  order by
    case when exists(select 1 from public.song_sources ex where ex.song_id=filtered.id and public.song_number_fold_v57(ex.song_number)=public.song_number_fold_v57(p_query) and trim(coalesce(p_query,''))<>'') then 0 else 1 end,
    case when p_sort='most_sung' then times_sung end desc nulls last,
    case when p_sort in ('most_sung','last_sung') then last_used_at end desc nulls last,
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
    'song_sources',(select coalesce(jsonb_agg(jsonb_build_object('source_id',ss.id,'song_number',ss.song_number,'source_title',ss.source_title,'song_collections',jsonb_build_object('id',sc.id,'name',sc.name,'short_code',sc.short_code)) order by sc.name,ss.song_number,ss.id),'[]'::jsonb) from public.song_sources ss left join public.song_collections sc on sc.id=ss.collection_id where ss.song_id=p.id),
    'song_categories',(select coalesce(jsonb_agg(jsonb_build_object('categories',jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug)) order by c.name),'[]'::jsonb) from public.song_categories x join public.categories c on c.id=x.category_id where x.song_id=p.id),
    'song_files',(select coalesce(jsonb_agg(jsonb_build_object('import_status',sf.import_status) order by sf.created_at,sf.id),'[]'::jsonb) from public.song_files sf where sf.song_id=p.id)
  )) from paged p),'[]'::jsonb)
);
$$;
revoke all on function public.list_song_library_v46(uuid,uuid,text,text,text,text,integer,integer,text) from public,anon;
grant execute on function public.list_song_library_v46(uuid,uuid,text,text,text,text,integer,integer,text) to authenticated;

create or replace function public.search_program_songs_v49(p_query text,p_limit integer default 8)
returns table(song_id uuid,title text,default_key text,bpm integer,rank real,matched_source text)
language plpgsql security definer set search_path=public as $$
declare term text;pattern text;number_term text;
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501'; end if;
 term:=public.search_fold_v49(left(trim(coalesce(p_query,'')),160));
 if length(term)<2 and term!~'^[0-9]$' then return; end if;
 pattern:='%'||replace(replace(replace(term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 number_term:=regexp_replace(term,'^nr\.?\s*','');
 perform public.record_activity_v48('search','/api/songs/search',jsonb_build_object('query',term));
 return query
 with title_matches as materialized (
  select s.id,case when public.search_fold_v49(s.title)=term then 0 when public.search_fold_v49(s.title) like substr(pattern,2) then 1 else 2 end priority
  from public.songs s where s.is_active and public.search_fold_v49(s.title) like pattern
  order by priority,s.title,s.id limit 80
 ), source_matches as materialized (
  select distinct s.id,s.title as source_song_title,case when public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(number_term) then 0 else 3 end priority
  from public.song_sources ss join public.songs s on s.id=ss.song_id and s.is_active
  where public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(number_term) or public.search_fold_v49(ss.song_number) like replace(replace(replace(number_term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%'
    or public.search_fold_v49(ss.source_title) like pattern
  order by priority,source_song_title,s.id
 ), lyric_matches as materialized (
  select s.id,4 priority from public.songs s where s.is_active and length(term)>=2 and (s.search_vector @@ plainto_tsquery('simple',term) or s.search_text like pattern)
  order by s.title,s.id limit 80
 ), chosen as (
  select s.id,s.title,s.default_key,s.bpm,min(c.priority) priority from (select * from title_matches union all select id,priority from source_matches union all select * from lyric_matches)c join public.songs s on s.id=c.id
  group by s.id order by min(c.priority),s.title,s.id limit least(greatest(coalesce(p_limit,8),1),30)
 )
 select c.id,c.title,c.default_key,c.bpm,(5-c.priority)::real,
  (select string_agg(distinct coalesce(sc.short_code,sc.name)||case when ss.song_number is not null then ' nr. '||ss.song_number else '' end,', ')
   from public.song_sources ss join public.song_collections sc on sc.id=ss.collection_id where ss.song_id=c.id)
 from chosen c order by c.priority,c.title,c.id;
end $$;
revoke all on function public.search_program_songs_v49(text,integer) from public,anon;
grant execute on function public.search_program_songs_v49(text,integer) to authenticated;
alter table public.meeting_items add column if not exists add_request_id_v57 uuid;
create unique index if not exists meeting_item_add_request_v57 on public.meeting_items(add_request_id_v57) where add_request_id_v57 is not null;
create or replace function public.add_program_song_v57(p_meeting_id uuid,p_song_id uuid,p_request_id uuid,p_source_id uuid default null,p_is_backup boolean default false,p_selected_key text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare iid uuid; saved jsonb; existing public.meeting_items;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_request_id is null then raise exception 'Cerere invalidă.';end if;
 perform 1 from public.meetings where id=p_meeting_id for update;
 if not found then raise exception 'Program inexistent.';end if;
 select * into existing from public.meeting_items where add_request_id_v57=p_request_id;
 if found then
  if existing.meeting_id<>p_meeting_id or existing.song_id<>p_song_id or existing.is_backup is distinct from p_is_backup or (p_source_id is not null and existing.selected_source_id is distinct from p_source_id) then raise exception 'Cerere incompatibilă.';end if;
  iid:=existing.id;
 else
  if not exists(select 1 from public.songs where id=p_song_id and is_active) then raise exception 'Cântarea nu este disponibilă.';end if;
  iid:=public.add_program_song_v52(p_meeting_id,p_song_id,p_source_id,p_is_backup,p_selected_key,null);
  update public.meeting_items set add_request_id_v57=p_request_id where id=iid;
 end if;
 saved:=public.get_meeting_snapshot_v46(p_meeting_id);
 if not exists(select 1 from jsonb_array_elements(saved->'items') x where x->>'id'=iid::text and x->>'song_id'=p_song_id::text) then raise exception 'Salvarea nu a putut fi confirmată.';end if;
 return jsonb_build_object('itemId',iid,'snapshot',saved);
end $$;
revoke all on function public.add_program_song_v57(uuid,uuid,uuid,uuid,boolean,text) from public,anon;
grant execute on function public.add_program_song_v57(uuid,uuid,uuid,uuid,boolean,text) to authenticated;
create or replace function public.create_program_with_song_v57(p_request_id uuid,p_title text,p_meeting_type text,p_meeting_date timestamptz,p_song_id uuid,p_is_backup boolean default false,p_source_id uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_source_id is not null and not exists(select 1 from public.song_sources where id=p_source_id and song_id=p_song_id) then raise exception 'Sursa invalidă.';end if;
 mid:=public.create_meeting_once_v49(p_request_id,p_title,p_meeting_type,p_meeting_date,null,p_song_id,p_is_backup);
 if p_source_id is not null then update public.meeting_items set selected_source_id=p_source_id where meeting_id=mid and song_id=p_song_id;end if;
 return mid;
end $$;
revoke all on function public.create_program_with_song_v57(uuid,text,text,timestamptz,uuid,boolean,uuid) from public,anon;
grant execute on function public.create_program_with_song_v57(uuid,text,text,timestamptz,uuid,boolean,uuid) to authenticated;
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
          'item_type', mi.item_type,'moment_color',mi.moment_color,'moment_kind',mi.moment_kind,
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


notify pgrst,'reload schema';
commit;


-- FILE: 051_v57_books_repair.sql
begin;
-- Private recovery copies: old lyrics/sections and source identity before any book repair.
create table if not exists public.book_repair_backups_v57(
 id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),actor_id uuid,category text not null,song_id uuid not null,old_song jsonb not null,old_sections jsonb not null,old_source jsonb,reason text not null
);
alter table public.book_repair_backups_v57 enable row level security;
revoke all on public.book_repair_backups_v57 from public,anon,authenticated;
create or replace function public.book_collection_v57(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare ids uuid[];cid uuid;
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_code='cr' then return public.red_book_collection_v55();end if;
 if p_code is distinct from 'cn' then raise exception 'Categorie nepermisă.';end if;
 perform pg_advisory_xact_lock(hashtextextended('songapp-book-cn-v57',0));
 select array_agg(id) into ids from public.song_collections where public.normalize_song_title_for_duplicates(name) in ('carteaneagracantarileevangheliei','carteneagracantarileevangheliei','cantarileevanghelieicarteaneagra','cantarileevanghelieicarteneagra');
 if cardinality(ids)>1 then raise exception 'Mai multe colecții Carte Neagră: unifică destinația înainte de import.';end if;
 if cardinality(ids)=1 then cid:=ids[1];else
  insert into public.song_collections(name,short_code,source_type,is_active,color) values('Cartea Neagră - Cântările Evangheliei',case when exists(select 1 from public.song_collections where short_code='CN') then 'CN_IMPORT_V57' else 'CN' end,'ppt',true,'#334155') returning id into cid;
 end if;
 return (select jsonb_build_object('id',id,'name',name) from public.song_collections where id=cid);
end $$;
revoke all on function public.book_collection_v57(text) from public,anon;
grant execute on function public.book_collection_v57(text) to authenticated,service_role;
create or replace function public.upsert_book_song_v57(p_code text,p_title text,p_number text,p_lyrics text,p_sections jsonb,p_source_ids jsonb,p_url text) returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid;sid uuid;prior uuid;ids uuid[];src public.song_sources;old public.songs;sec jsonb;x jsonb;source_id text;pos integer:=0;changed boolean:=false;result text:='existing';
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_code not in ('cr','cn') or p_code is null or length(trim(coalesce(p_title,''))) not between 1 and 300 or length(trim(coalesce(p_lyrics,''))) not between 20 and 100000 or (p_number is not null and p_number !~ '^[0-9]{1,4}$') then raise exception 'Date cântare invalide.';end if;
 if p_code='cr' and (p_number is null or p_number::integer not between 1 and 601) then raise exception 'Număr Carte Roșie invalid.';end if;
 if jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections) not between 1 and 300 or jsonb_typeof(p_source_ids) is distinct from 'array' or jsonb_array_length(p_source_ids) not between 1 and 10 then raise exception 'Structură invalidă.';end if;
 if p_url is null or p_url !~ '^https://(www\.)?cantaricrestine\.ro/[^?#]+$' then raise exception 'Sursă invalidă.';end if;
 for source_id in select jsonb_array_elements_text(p_source_ids) loop if source_id !~ '^[0-9]{1,20}$' then raise exception 'ID sursă invalid.';end if;end loop;
 for x in select value from jsonb_array_elements(p_sections) loop
  if x->>'section_type' not in ('verse','chorus','bridge','intro','outro','prechorus','ending','other') or nullif(trim(x->>'content'),'') is null then raise exception 'Strofă invalidă.';end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended('songapp-book-'||p_code||'-v57',0));
 cid:=(public.book_collection_v57(p_code)->>'id')::uuid;
 select array_agg(distinct ss.song_id) into ids from public.song_sources ss join public.song_link_imports li on li.song_id=ss.song_id where ss.collection_id=cid and li.source_key in(select 'cantaricrestine:'||p_code||':'||jsonb_array_elements_text(p_source_ids));
 if cardinality(ids)>1 then return jsonb_build_object('status','review','reason','Identități sursă conflictuale.');end if;
 if cardinality(ids)=1 then sid:=ids[1];end if;
 if p_number is not null then
  select array_agg(distinct song_id) into ids from public.song_sources where collection_id=cid and public.song_number_fold_v57(song_number)=public.song_number_fold_v57(p_number);
  if cardinality(ids)>0 and sid is not null and not(sid=any(ids)) then return jsonb_build_object('status','review','reason','Identitatea sursei și numărul indică piese diferite.');end if;
  if sid is null and cardinality(ids)>0 then
   select s.id into sid from public.songs s where s.id=any(ids) and s.is_active order by (public.normalize_song_title_for_duplicates(s.title)=public.normalize_song_title_for_duplicates(p_title)) desc,s.created_at,s.id limit 1;
   if sid is null then return jsonb_build_object('status','review','reason','Corespondentele numărului sunt inactive.');end if;
  end if;
 end if;
 if sid is null then
  select array_agg(distinct s.id) into ids from public.songs s join public.song_sources ss on ss.song_id=s.id where ss.collection_id=cid and s.is_active and public.normalize_song_title_for_duplicates(s.title)=public.normalize_song_title_for_duplicates(p_title) and (p_number is null or nullif(ss.song_number,'') is null);
  if cardinality(ids)>0 then select id into sid from public.songs where id=any(ids) order by created_at,id limit 1;end if;
 end if;
 if sid is not null then
  select * into old from public.songs where id=sid for update;
  if not old.is_active then return jsonb_build_object('status','review','reason','Cântare inactivă; păstrată.');end if;
  select * into src from public.song_sources where song_id=sid and collection_id=cid order by case when p_number is not null and public.song_number_fold_v57(song_number)=public.song_number_fold_v57(p_number) then 0 else 1 end,created_at,id limit 1;
  select coalesce(jsonb_agg(to_jsonb(s) order by position,id),'[]') into sec from public.song_sections s where song_id=sid;
  changed:=old.lyrics_text is distinct from trim(p_lyrics) or old.title is distinct from trim(p_title) or
   (select coalesce(jsonb_agg(jsonb_build_object('content',v->>'content','section_type',v->>'section_type','section_label',v->>'section_label') order by (v->>'position')::integer),'[]') from jsonb_array_elements(sec) v)
   is distinct from (select jsonb_agg(jsonb_build_object('content',v->>'content','section_type',v->>'section_type','section_label',v->>'section_label') order by ord) from jsonb_array_elements(p_sections) with ordinality a(v,ord));
  if changed then
   insert into public.book_repair_backups_v57(actor_id,category,song_id,old_song,old_sections,old_source,reason) values(auth.uid(),p_code,sid,to_jsonb(old),sec,to_jsonb(src),'Reparare autorizată din catalog API / slide-uri curente');
   -- Different books may use different versions of the same hymn. Keep other collections intact.
   if exists(select 1 from public.song_sources where song_id=sid and (collection_id<>cid or (p_number is not null and nullif(song_number,'') is not null and public.song_number_fold_v57(song_number)<>public.song_number_fold_v57(p_number)))) then
    prior:=sid;
    insert into public.songs(title,lyrics_text,default_key,bpm,structure,notes) values(trim(p_title),trim(p_lyrics),old.default_key,old.bpm,old.structure,old.notes) returning id into sid;
    update public.song_sources set song_id=sid where id=src.id;
    update public.meeting_items set song_id=sid where selected_source_id=src.id and song_id=prior;
    update public.song_link_imports set song_id=sid where song_id=prior and source_key like 'cantaricrestine:'||p_code||':%';
   else update public.songs set title=trim(p_title),lyrics_text=trim(p_lyrics) where id=sid;end if;
   result:='repaired';
  end if;
 else
  insert into public.songs(title,lyrics_text) values(trim(p_title),trim(p_lyrics)) returning id into sid;changed:=true;result:='created';
 end if;
 if changed then
  delete from public.song_sections where song_id=sid;
  for x in select value from jsonb_array_elements(p_sections) loop pos:=pos+1;insert into public.song_sections(song_id,section_type,section_label,position,content) values(sid,x->>'section_type',x->>'section_label',pos,trim(x->>'content'));end loop;
 end if;
 if src.id is null then insert into public.song_sources(song_id,collection_id,song_number,source_title) values(sid,cid,p_number,'cantaricrestine.ro · '||p_code);else update public.song_sources set song_number=p_number where id=src.id;end if;
 for source_id in select jsonb_array_elements_text(p_source_ids) loop
  if exists(select 1 from public.song_link_imports where source_key='cantaricrestine:'||p_code||':'||source_id and song_id<>sid) then raise exception 'Identitate sursă ocupată: %',source_id;end if;
  insert into public.song_link_imports(source_key,source_url,song_id,imported_by) values('cantaricrestine:'||p_code||':'||source_id,p_url,sid,auth.uid()) on conflict(source_key) do nothing;
 end loop;
 return jsonb_build_object('status',result,'songId',sid,'collectionId',cid,'number',p_number);
end $$;
revoke all on function public.upsert_book_song_v57(text,text,text,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.upsert_book_song_v57(text,text,text,text,jsonb,jsonb,text) to authenticated,service_role;
create or replace function public.finalize_book_catalog_v57(p_code text,p_song_ids jsonb,p_expected integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid;archive uuid;ids uuid[];count_ids integer;src record;moved integer:=0;
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_code not in ('cr','cn') or p_code is null or jsonb_typeof(p_song_ids) is distinct from 'array' or p_expected<1 or (p_code='cr' and p_expected<>601) then raise exception 'Catalog invalid.';end if;
 select array_agg(distinct v::uuid) into ids from jsonb_array_elements_text(p_song_ids) v;
 if cardinality(ids) is distinct from p_expected then raise exception 'Catalog incomplet: arhivarea a fost oprită.';end if;
 cid:=(public.book_collection_v57(p_code)->>'id')::uuid;
 select count(distinct song_id) into count_ids from public.song_sources where collection_id=cid and song_id=any(ids);
 if count_ids<>p_expected then raise exception 'Import incomplet: arhivarea a fost oprită.';end if;
 if exists(select 1 from public.song_sources where collection_id=cid and not(song_id=any(ids))) then
  select id into archive from public.song_collections where short_code='ARCHIVE_'||upper(p_code)||'_V57' limit 1;
  if archive is null then insert into public.song_collections(name,short_code,source_type,is_active,color) values('Arhivă import anterior · '||upper(p_code),'ARCHIVE_'||upper(p_code)||'_V57','manual',false,'#64748b') returning id into archive;end if;
  for src in select * from public.song_sources where collection_id=cid and not(song_id=any(ids)) loop
   insert into public.book_repair_backups_v57(actor_id,category,song_id,old_song,old_sections,old_source,reason)
    select auth.uid(),p_code,s.id,to_jsonb(s),coalesce((select jsonb_agg(to_jsonb(x) order by x.position,x.id) from public.song_sections x where x.song_id=s.id),'[]'),to_jsonb(src),'Arhivare înregistrare veche din afara catalogului confirmat' from public.songs s where s.id=src.song_id;
   update public.song_sources set collection_id=archive where id=src.id;moved:=moved+1;
   if not exists(select 1 from public.song_sources where song_id=src.song_id and collection_id<>archive) then update public.songs set is_active=false where id=src.song_id;end if;
  end loop;
 end if;
 return jsonb_build_object('songs',count_ids,'archivedSources',moved);
end $$;
revoke all on function public.finalize_book_catalog_v57(text,jsonb,integer) from public,anon;
grant execute on function public.finalize_book_catalog_v57(text,jsonb,integer) to authenticated,service_role;
notify pgrst,'reload schema';
commit;


-- FILE: 052_v57_1_safe_import.sql
-- SongApp v57.1: protecție pentru baza existentă după UPDATE-V57.sql.
-- Nu importă, nu șterge, nu arhivează și nu dezactivează cântări.
begin;
do $$ begin
 if to_regprocedure('public.upsert_book_song_payload_v57_1(text,text,text,text,jsonb,jsonb,text)') is null then
  if to_regprocedure('public.upsert_book_song_v57(text,text,text,text,jsonb,jsonb,text)') is null then raise exception 'Rulează mai întâi UPDATE-V57.sql în aceeași bază.';end if;
  alter function public.upsert_book_song_v57(text,text,text,text,jsonb,jsonb,text) rename to upsert_book_song_payload_v57_1;
 end if;
end $$;
-- Payload-ul vechi rămâne privat. Apelurile publice trec prin protecția de mai jos.
revoke all on function public.upsert_book_song_payload_v57_1(text,text,text,text,jsonb,jsonb,text) from public,anon,authenticated,service_role;
create or replace function public.upsert_book_song_v57(p_code text,p_title text,p_number text,p_lyrics text,p_sections jsonb,p_source_ids jsonb,p_url text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_code='cn' then raise exception 'Importul parțial Carte Neagră din v57 este blocat. Este necesar catalogul verificat 001–805 și importatorul pentru ediția completă.';end if;
 return public.upsert_book_song_payload_v57_1(p_code,p_title,p_number,p_lyrics,p_sections,p_source_ids,p_url);
end $$;
revoke all on function public.upsert_book_song_v57(text,text,text,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.upsert_book_song_v57(text,text,text,text,jsonb,jsonb,text) to authenticated,service_role;
-- Finalizarea verifică numai identitățile confirmate. Nu mai mută sau dezactivează surse/piese.
create or replace function public.finalize_book_catalog_v57(p_code text,p_song_ids jsonb,p_expected integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid;ids uuid[];confirmed integer;required integer;
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_code is null or p_code not in ('cr','cn') or jsonb_typeof(p_song_ids) is distinct from 'array' then raise exception 'Catalog invalid.';end if;
 required:=case p_code when 'cr' then 601 else 805 end;
 if p_expected is distinct from required then raise exception 'Catalog incomplet: sunt necesare % cântări. Nu s-a arhivat nimic.',required;end if;
 select array_agg(distinct v::uuid) into ids from jsonb_array_elements_text(p_song_ids) v;
 if cardinality(ids) is distinct from required then raise exception 'Catalog incomplet: nu s-a arhivat nimic.';end if;
 cid:=(public.book_collection_v57(p_code)->>'id')::uuid;
 select count(distinct s.id) into confirmed from public.song_sources ss join public.songs s on s.id=ss.song_id where ss.collection_id=cid and s.id=any(ids) and s.is_active;
 if confirmed<>required then raise exception 'Import incomplet: nu s-a arhivat nimic.';end if;
 if exists(select 1 from generate_series(1,required) n where not exists(select 1 from public.song_sources ss where ss.collection_id=cid and ss.song_id=any(ids) and public.song_number_fold_v57(ss.song_number)=n::text)) then raise exception 'Numerotarea nu acoperă toate cele % poziții.',required;end if;
 return jsonb_build_object('songs',confirmed,'archivedSources',0,'archivalDisabled',true);
end $$;
revoke all on function public.finalize_book_catalog_v57(text,jsonb,integer) from public,anon;
grant execute on function public.finalize_book_catalog_v57(text,jsonb,integer) to authenticated,service_role;
notify pgrst,'reload schema';
commit;


-- FILE: 053_v58_presentation_import.sql
begin;
alter table public.song_collections add column if not exists presentation_collection_v58 boolean not null default false;
alter table public.song_collections add column if not exists presentation_catalog_key_v58 text;
create unique index if not exists presentation_catalog_key_v58 on public.song_collections(presentation_catalog_key_v58) where presentation_catalog_key_v58 is not null;
alter table public.song_files add column if not exists presentation_only_v58 boolean not null default false;
alter table public.song_files add column if not exists source_number_v58 text;
alter table public.song_files add column if not exists sha256_v58 text;
alter table public.song_files add column if not exists preview_sha256_v58 text;
alter table public.song_files add column if not exists preview_path_v58 text;
alter table public.song_files add column if not exists upload_complete_v58 boolean not null default false;
create unique index if not exists presentation_number_v58 on public.song_files(collection_id,source_number_v58) where presentation_only_v58;
update storage.buckets set allowed_mime_types=(select array_agg(distinct v) from unnest(coalesce(allowed_mime_types,array[]::text[])||array['application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/pdf']) v) where id='song-files';
create or replace function public.presentation_collection_v58(p_collection_id uuid default null,p_name text default 'Cartea Neagră - Cântările Evangheliei · PPT') returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid;ids uuid[];code text;
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_collection_id is not null then
  select id into cid from public.song_collections where id=p_collection_id and is_active;
  if cid is null then raise exception 'Colecția nu este disponibilă.';end if;
 else
  if length(trim(coalesce(p_name,''))) not between 1 and 200 then raise exception 'Numele colecției este obligatoriu.';end if;
  perform pg_advisory_xact_lock(hashtextextended('presentations-v58:'||trim(p_name),0));
  select array_agg(id) into ids from public.song_collections where is_active and ((trim(p_name)='Cartea Neagră - Cântările Evangheliei · PPT' and presentation_catalog_key_v58='black-book-ppt') or (trim(p_name)<>'Cartea Neagră - Cântările Evangheliei · PPT' and presentation_collection_v58 and name=trim(p_name)));
  if cardinality(ids)>1 then raise exception 'Mai multe colecții corespondente. Alege explicit destinația.';end if;
  if cardinality(ids)=1 then cid:=ids[1];else
   code:=case when trim(p_name)='Cartea Neagră - Cântările Evangheliei · PPT' and not exists(select 1 from public.song_collections where short_code='CN_PPT') then 'CN_PPT' else 'PPT_'||left(replace(gen_random_uuid()::text,'-',''),12) end;
   insert into public.song_collections(name,short_code,source_type,is_active,color,presentation_collection_v58,presentation_catalog_key_v58) values(trim(p_name),code,'ppt',true,'#334155',true,case when trim(p_name)='Cartea Neagră - Cântările Evangheliei · PPT' then 'black-book-ppt' else null end) returning id into cid;
  end if;
 end if;
 return (select jsonb_build_object('id',id,'name',name) from public.song_collections where id=cid);
end $$;
revoke all on function public.presentation_collection_v58(uuid,text) from public,anon;
grant execute on function public.presentation_collection_v58(uuid,text) to authenticated,service_role;
create or replace function public.register_presentation_v58(p_collection_id uuid,p_number text,p_title text,p_file_name text,p_sha256 text,p_preview_sha256 text default null,p_first_line text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare num text;ext text;sid uuid;fid uuid;src uuid;ids uuid[];old public.song_files;original_path text;pdf_path text;result text:='existing';
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_number is null or p_number !~ '^[0-9]{1,4}$' or p_number::integer not between 1 and 9999 or length(trim(coalesce(p_title,''))) not between 1 and 300 or length(coalesce(p_file_name,'')) not between 1 and 240 or p_file_name ~ '[/\\]' then raise exception 'Număr, titlu sau nume de fișier invalid.';end if;
 ext:=lower(substring(p_file_name from '\.([^.]+)$'));
 if ext is null or ext not in ('ppt','pptx') or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or (p_preview_sha256 is not null and p_preview_sha256 !~ '^[a-f0-9]{64}$') then raise exception 'Format sau amprentă fișier invalidă.';end if;
 num:=lpad(p_number::integer::text,greatest(3,length(p_number::integer::text)),'0');
 perform 1 from public.song_collections where id=p_collection_id and is_active for update;
 if not found then raise exception 'Colecție indisponibilă.';end if;
 select * into old from public.song_files where collection_id=p_collection_id and presentation_only_v58 and source_number_v58=num for update;
 if found then sid:=old.song_id;fid:=old.id;
  if sid is null or not exists(select 1 from public.songs where id=sid and is_active) then raise exception 'Cântarea legată a fost eliminată sau dezactivată. Verifică manual corespondentul.';end if;
 else
  select array_agg(distinct s.id) into ids from public.songs s join public.song_sources ss on ss.song_id=s.id where ss.collection_id=p_collection_id and public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(num) and s.is_active and public.normalize_song_title_for_duplicates(s.title)=public.normalize_song_title_for_duplicates(p_title);
  if cardinality(ids)>1 then raise exception 'Mai multe cântări cu același număr și titlu. Unifică duplicatele înainte de import.';end if;
  if cardinality(ids)=1 then sid:=ids[1];result:='linked';else
   if exists(select 1 from public.song_sources ss join public.songs s on s.id=ss.song_id where ss.collection_id=p_collection_id and s.is_active and public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(num)) then raise exception 'Numărul % există cu alt titlu. Alege colecția PPT separată sau verifică manual ediția.',num;end if;
   insert into public.songs(title) values(trim(p_title)) returning id into sid;result:='created';
  end if;
 end if;
 select id into src from public.song_sources where song_id=sid and collection_id=p_collection_id and public.song_number_fold_v57(song_number)=public.song_number_fold_v57(num) order by created_at,id limit 1;
 if src is null then insert into public.song_sources(song_id,collection_id,song_number,source_title) values(sid,p_collection_id,num,p_file_name||case when nullif(trim(p_first_line),'') is null then '' else ' · '||left(trim(p_first_line),300) end) returning id into src;end if;
 if fid is not null and old.sha256_v58=p_sha256 and p_preview_sha256 is null then p_preview_sha256:=old.preview_sha256_v58;end if;
 original_path:='presentations/'||p_collection_id::text||'/'||num||'-'||p_sha256||'.'||ext;
 pdf_path:=case when p_preview_sha256 is null then null else 'presentations/'||p_collection_id::text||'/'||num||'-'||p_preview_sha256||'.pdf' end;
 if fid is null then
  insert into public.song_files(collection_id,song_id,file_name,file_type,storage_path,import_status,parser_notes,presentation_only_v58,source_number_v58,sha256_v58,preview_sha256_v58,preview_path_v58)
  values(p_collection_id,sid,p_file_name,ext::public.collection_source_type,original_path,'approved','Titlu și prezentare importate. Versurile nu au fost extrase.',true,num,p_sha256,p_preview_sha256,pdf_path) returning id into fid;
 else
  update public.song_files set file_name=p_file_name,file_type=ext::public.collection_source_type,storage_path=original_path,preview_path_v58=pdf_path,sha256_v58=p_sha256,preview_sha256_v58=p_preview_sha256,upload_complete_v58=case when sha256_v58 is not distinct from p_sha256 and preview_sha256_v58 is not distinct from p_preview_sha256 then upload_complete_v58 else false end where id=fid;
 end if;
 return (select jsonb_build_object('status',result,'songId',sid,'fileId',fid,'sourceId',src,'path',storage_path,'previewPath',preview_path_v58,'complete',upload_complete_v58) from public.song_files where id=fid);
end $$;
revoke all on function public.register_presentation_v58(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.register_presentation_v58(uuid,text,text,text,text,text,text) to authenticated,service_role;
create or replace function public.complete_presentation_v58(p_file_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare f public.song_files;
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 select * into f from public.song_files where id=p_file_id and presentation_only_v58 for update;
 if not found then raise exception 'Fișier inexistent.';end if;
 if not exists(select 1 from storage.objects where bucket_id='song-files' and name=f.storage_path) or (f.preview_path_v58 is not null and not exists(select 1 from storage.objects where bucket_id='song-files' and name=f.preview_path_v58)) then raise exception 'Încărcarea fișierelor nu este completă. Reia importul.';end if;
 update public.song_files set upload_complete_v58=true where id=f.id;
 return jsonb_build_object('fileId',f.id,'songId',f.song_id,'complete',true);
end $$;
revoke all on function public.complete_presentation_v58(uuid) from public,anon;
grant execute on function public.complete_presentation_v58(uuid) to authenticated,service_role;
notify pgrst,'reload schema';
commit;


-- FILE: 054_v59_public_moment_types.sql
begin;
alter table public.public_meeting_contributions drop constraint if exists public_meeting_contributions_contribution_type_check;
alter table public.public_meeting_contributions add constraint public_meeting_contributions_contribution_type_check check(contribution_type in ('song','text','prayer','encouragement','message','break','other'));
create or replace function public.add_public_meeting_contribution(
  p_public_slug text,
  p_contribution_type text default 'song',
  p_song_id uuid default null,
  p_custom_title text default null,
  p_custom_text text default null,
  p_is_backup boolean default false,
  p_proposed_position integer default null,
  p_contributor_name text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
  v_id uuid;
  v_position integer;
begin
  select l.id as share_link_id, l.meeting_id
  into v_link
  from public.meeting_share_links l
  where l.public_slug = p_public_slug
    and l.is_active = true and l.allow_contributions
    and (l.expires_at is null or l.expires_at > now())
  limit 1;

  if v_link.share_link_id is null then
    raise exception 'Linkul public nu este activ.';
  end if;

  p_contribution_type := coalesce(nullif(p_contribution_type, ''), 'song');
  if p_contribution_type not in ('song','text','prayer','encouragement','message','break','other') then
    raise exception 'Tip de contribuție invalid.';
  end if;

  if p_song_id is null and coalesce(trim(p_custom_title), '') = '' and coalesce(trim(p_custom_text), '') = '' then
    raise exception 'Adaugă o cântare sau completează un text.';
  end if;

  if p_song_id is not null and not exists (select 1 from public.songs s where s.id = p_song_id and s.is_active = true) then
    raise exception 'Cântarea selectată nu există.';
  end if;

  if p_proposed_position is not null then
    v_position := greatest(1, least(p_proposed_position, 999));
  else
    v_position := null;
  end if;

  insert into public.public_meeting_contributions (
    meeting_id,
    share_link_id,
    contribution_type,
    song_id,
    custom_title,
    custom_text,
    is_backup,
    proposed_position,
    contributor_name,
    notes,
    status
  ) values (
    v_link.meeting_id,
    v_link.share_link_id,
    p_contribution_type,
    p_song_id,
    nullif(left(trim(coalesce(p_custom_title, '')), 180), ''),
    nullif(left(trim(coalesce(p_custom_text, '')), 4000), ''),
    coalesce(p_is_backup, false),
    v_position,
    nullif(left(trim(coalesce(p_contributor_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_notes, '')), 1000), ''),
    'pending'
  ) returning id into v_id;

  return v_id;
end;
$$;
create or replace function public.accept_public_meeting_contribution(p_contribution_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.public_meeting_contributions; mid uuid; result uuid; before_id uuid; note text;
begin
 if not public.can_edit_content() then raise exception 'Nu ai permisiunea să accepți propuneri.' using errcode='42501';end if;
 select meeting_id into mid from public.public_meeting_contributions where id=p_contribution_id;
 if mid is null then raise exception 'Propunerea nu există.';end if;
 perform 1 from public.meetings where id=mid for update;
 select * into c from public.public_meeting_contributions where id=p_contribution_id for update;
 if not found then raise exception 'Propunerea nu mai există.';end if;
 if c.status<>'pending' then raise exception 'Propunerea a fost deja procesată.';end if;
 if c.proposed_position is not null then
  select id into before_id from public.meeting_items where meeting_id=mid and is_backup=c.is_backup order by position,id offset greatest(c.proposed_position-1,0) limit 1;
 end if;
 note:=concat_ws(E'\n',nullif(c.notes,''),'Adăugată din link public'||case when nullif(c.contributor_name,'') is not null then ' de '||c.contributor_name else '' end);
 if c.song_id is not null then
  if not exists(select 1 from public.songs where id=c.song_id and is_active) then raise exception 'Cântarea propusă nu mai este disponibilă.';end if;
  result:=public.add_song_to_meeting(mid,c.song_id,c.is_backup,null,note);
 else
  result:=public.add_moment_v57(mid,c.contribution_type,c.custom_title,c.custom_text,'#d97706');
  update public.meeting_items set notes=nullif(note,'') where id=result;
 end if;
 perform public.place_meeting_item_v45(mid,result,c.is_backup,before_id);
 update public.public_meeting_contributions set status='accepted',reviewed_at=now(),reviewed_by=auth.uid() where id=c.id;
 return result;
end $$;
revoke all on function public.accept_public_meeting_contribution(uuid) from public,anon;
grant execute on function public.accept_public_meeting_contribution(uuid) to authenticated;


notify pgrst,'reload schema';
commit;


-- FILE: 055_v62_program_details.sql
begin;
alter table public.songs add column if not exists verse_count_override integer check(verse_count_override between 0 and 100);
alter table public.meeting_items add column if not exists performance_structure text;
create or replace function public.song_details_internal_v62(p_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('verse_count',coalesce(s.verse_count_override,(select nullif(count(*) filter(where section_type='verse'),0)::int from public.song_sections where song_id=s.id)),
 'structure',s.structure,
 'first_verse',coalesce((select left(content,2500) from public.song_sections where song_id=s.id and section_type='verse' order by position,id limit 1),nullif(left(split_part(coalesce(s.lyrics_text,''),E'\n\n',1),2500),'')),
 'chorus',(select left(content,2500) from public.song_sections where song_id=s.id and section_type='chorus' order by position,id limit 1)) from public.songs s where s.id=p_id;
$$;
revoke all on function public.song_details_internal_v62(uuid) from public,anon,authenticated;
create or replace function public.song_details_v62(p_song_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 return public.song_details_internal_v62(p_song_id);
end $$;
revoke all on function public.song_details_v62(uuid) from public,anon;
grant execute on function public.song_details_v62(uuid) to authenticated;
create or replace function public.get_meeting_snapshot_v46(p_meeting_id uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('revision',m.program_revision,'principal',m.principal_responsible,'secondary',m.secondary_responsibles,
 'items',coalesce((select jsonb_agg(to_jsonb(mi)||jsonb_build_object('sources',public.song_sources_v52(mi.song_id),'songs',case when s.id is null then null else jsonb_build_object('id',s.id,'title',s.title,'lyrics_text',s.lyrics_text,'default_key',s.default_key,'bpm',s.bpm,'structure',s.structure)||public.song_details_v62(s.id) end) order by mi.position,mi.id)
 from public.meeting_items mi left join public.songs s on s.id=mi.song_id where mi.meeting_id=m.id),'[]'::jsonb)) from public.meetings m where m.id=p_meeting_id;
$$;
revoke all on function public.get_meeting_snapshot_v46(uuid) from public,anon;
grant execute on function public.get_meeting_snapshot_v46(uuid) to authenticated;
create or replace function public.get_shared_meeting(p_public_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'meeting', jsonb_build_object(
      'id',m.id,'title', m.title,
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
          'id',mi.id,'performance_structure',mi.performance_structure,'position', mi.position,
          'item_type', mi.item_type,'moment_color',mi.moment_color,'moment_kind',mi.moment_kind,
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
            'id',s.id,'verse_count',(public.song_details_internal_v62(s.id)->'verse_count'),'title', s.title,
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


create or replace function public.search_program_songs_filtered_v62(p_query text,p_limit integer default 8,p_collection uuid default null,p_category uuid default null,p_key text default null)
returns table(song_id uuid,title text,default_key text,bpm integer,rank real,matched_source text)
language plpgsql security definer set search_path=public as $$
declare term text;pattern text;number_term text;
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501'; end if;
 term:=public.search_fold_v49(left(trim(coalesce(p_query,'')),160));
 if length(term)<2 and term!~'^[0-9]$' and p_collection is null and p_category is null and p_key is null then return; end if;
 pattern:='%'||replace(replace(replace(term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 number_term:=regexp_replace(term,'^nr\.?\s*','');
 perform public.record_activity_v48('search','/api/songs/search',jsonb_build_object('query',term));
 return query
 with title_matches as materialized (
  select s.id,case when public.search_fold_v49(s.title)=term then 0 when public.search_fold_v49(s.title) like substr(pattern,2) then 1 else 2 end priority
  from public.songs s where s.is_active and (p_collection is null or exists(select 1 from public.song_sources z where z.song_id=s.id and z.collection_id=p_collection)) and (p_category is null or exists(select 1 from public.song_categories z where z.song_id=s.id and z.category_id=p_category)) and (p_key is null or s.default_key=p_key) and public.search_fold_v49(s.title) like pattern
  order by priority,s.title,s.id limit 80
 ), source_matches as materialized (
  select distinct s.id,s.title as source_song_title,case when public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(number_term) then 0 else 3 end priority
  from public.song_sources ss join public.songs s on s.id=ss.song_id and s.is_active and (p_collection is null or exists(select 1 from public.song_sources z where z.song_id=s.id and z.collection_id=p_collection)) and (p_category is null or exists(select 1 from public.song_categories z where z.song_id=s.id and z.category_id=p_category)) and (p_key is null or s.default_key=p_key)
  where public.song_number_fold_v57(ss.song_number)=public.song_number_fold_v57(number_term) or public.search_fold_v49(ss.song_number) like replace(replace(replace(number_term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%'
    or public.search_fold_v49(ss.source_title) like pattern
  order by priority,source_song_title,s.id
 ), lyric_matches as materialized (
  select s.id,4 priority from public.songs s where s.is_active and (p_collection is null or exists(select 1 from public.song_sources z where z.song_id=s.id and z.collection_id=p_collection)) and (p_category is null or exists(select 1 from public.song_categories z where z.song_id=s.id and z.category_id=p_category)) and (p_key is null or s.default_key=p_key) and length(term)>=2 and (s.search_vector @@ plainto_tsquery('simple',term) or s.search_text like pattern)
  order by s.title,s.id limit 80
 ), chosen as (
  select s.id,s.title,s.default_key,s.bpm,min(c.priority) priority from (select * from title_matches union all select id,priority from source_matches union all select * from lyric_matches)c join public.songs s on s.id=c.id
  group by s.id order by min(c.priority),s.title,s.id limit least(greatest(coalesce(p_limit,8),1),30)
 )
 select c.id,c.title,c.default_key,c.bpm,(5-c.priority)::real,
  (select string_agg(distinct coalesce(sc.short_code,sc.name)||case when ss.song_number is not null then ' nr. '||ss.song_number else '' end,', ')
   from public.song_sources ss join public.song_collections sc on sc.id=ss.collection_id where ss.song_id=c.id)
 from chosen c order by c.priority,c.title,c.id;
end $$;
revoke all on function public.search_program_songs_filtered_v62(text,integer,uuid,uuid,text) from public,anon;
grant execute on function public.search_program_songs_filtered_v62(text,integer,uuid,uuid,text) to authenticated;
create or replace function public.search_program_songs_v62(p_query text,p_limit integer default 30,p_exclude_meeting uuid default null,p_collection uuid default null,p_category uuid default null,p_key text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(r)||public.song_details_internal_v62(r.song_id)||jsonb_build_object('sources',case when p_collection is null then public.song_sources_v52(r.song_id) else coalesce((select jsonb_agg(src) from jsonb_array_elements(public.song_sources_v52(r.song_id)) src where src->>'collection_id'=p_collection::text),'[]'::jsonb) end,'schedule',jsonb_build_object(
 'next',(select to_jsonb(e) from public.song_program_events_v52(r.song_id,p_exclude_meeting)e where e.phase<>'finished' order by e.meeting_date,e.meeting_id limit 1),
 'last',(select to_jsonb(e) from public.song_program_events_v52(r.song_id,p_exclude_meeting)e where e.phase='finished' and not e.is_backup order by e.meeting_date desc,e.meeting_id limit 1))) order by r.rank desc,r.title,r.song_id),'[]'::jsonb) into result
 from public.search_program_songs_filtered_v62(p_query,p_limit,p_collection,p_category,p_key) r;
 return result;
end $$;
revoke all on function public.search_program_songs_v62(text,integer,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.search_program_songs_v62(text,integer,uuid,uuid,uuid,text) to authenticated;
create or replace function public.update_program_song_v62(p_meeting_id uuid,p_item_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare sid uuid; pattern text; n integer;
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
 if length(coalesce(p_data->>'notes',''))>5000 or length(coalesce(p_data->>'responsible_name',''))>120 or length(coalesce(p_data->>'selected_key',''))>20 then raise exception 'Text prea lung.';end if;
 if nullif(p_data->>'selected_source_id','') is not null and not exists(select 1 from public.song_sources where id=(p_data->>'selected_source_id')::uuid and song_id=sid) then raise exception 'Colecția nu aparține cântării.';end if;
 update public.meeting_items set responsible_name=nullif(p_data->>'responsible_name',''),notes=nullif(p_data->>'notes',''),selected_key=nullif(p_data->>'selected_key',''),selected_source_id=case when p_data ? 'selected_source_id' then nullif(p_data->>'selected_source_id','')::uuid else selected_source_id end,performance_structure=pattern where id=p_item_id;
 return public.get_meeting_snapshot_v46(p_meeting_id);
end $$;
revoke all on function public.update_program_song_v62(uuid,uuid,jsonb) from public,anon;
grant execute on function public.update_program_song_v62(uuid,uuid,jsonb) to authenticated;
create or replace function public.assign_song_category_v62(p_song_id uuid,p_category_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if not exists(select 1 from public.songs where id=p_song_id and is_active) or not exists(select 1 from public.categories where id=p_category_id) then raise exception 'Cântare sau categorie inexistentă.';end if;
 insert into public.song_categories(song_id,category_id) values(p_song_id,p_category_id) on conflict do nothing;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name) from public.categories c join public.song_categories sc on sc.category_id=c.id where sc.song_id=p_song_id),'[]'::jsonb);
end $$;
revoke all on function public.assign_song_category_v62(uuid,uuid) from public,anon;
grant execute on function public.assign_song_category_v62(uuid,uuid) to authenticated;
create or replace function public.program_search_filters_v62() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 return jsonb_build_object('collections',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.song_collections where is_active),'[]'::jsonb),'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.categories),'[]'::jsonb),'keys',coalesce((select jsonb_agg(k order by k) from (select distinct default_key k from public.songs where is_active and nullif(default_key,'') is not null) x),'[]'::jsonb));
end $$;
revoke all on function public.program_search_filters_v62() from public,anon;
grant execute on function public.program_search_filters_v62() to authenticated;
create or replace function public.duplicate_meeting(p_meeting_id uuid,p_title text,p_meeting_date timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_meeting public.meetings;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  if nullif(trim(p_title),'') is null or p_meeting_date is null then raise exception 'Titlul și data sunt obligatorii.'; end if;
  select * into v_meeting from public.meetings where id=p_meeting_id for share;
  if not found then raise exception 'Programul nu există.'; end if;
  insert into public.meetings(title,meeting_type,meeting_date,notes,created_by,status,principal_responsible,secondary_responsibles) values(trim(p_title),v_meeting.meeting_type,p_meeting_date,v_meeting.notes,auth.uid(),'draft',v_meeting.principal_responsible,v_meeting.secondary_responsibles) returning id into v_id;
  insert into public.meeting_items(meeting_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name,selected_source_id,is_congregational,performance_structure,moment_kind,moment_color)
    select v_id,position,item_type,song_id,custom_title,custom_text,selected_key,selected_bpm,is_backup,notes,responsible_name,selected_source_id,is_congregational,performance_structure,moment_kind,moment_color from public.meeting_items where meeting_id=p_meeting_id;
  return v_id;
end $$;


notify pgrst,'reload schema';
commit;


-- FILE: 056_v63_current_usage.sql
begin;
-- Performed history is derived from CURRENT main-list membership, never from audit rows.
-- Removing an item or moving it to backup removes the occurrence, even after the meeting.
create or replace view public.song_performance_occurrences_v46 with (security_invoker=true) as
select distinct mi.song_id,m.id as meeting_id,m.title as meeting_title,m.meeting_date,m.meeting_type
from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
where mi.song_id is not null and not mi.is_backup and not m.is_template and m.meeting_date<=now();
revoke all on public.song_performance_occurrences_v46 from public,anon;
grant select on public.song_performance_occurrences_v46 to authenticated;
notify pgrst,'reload schema';
commit;


-- FILE: 057_v64_backup.sql
begin;
-- Allow an archived order to swap existing positions atomically. Primary ID remains immediate.
alter table public.meeting_items drop constraint if exists meeting_items_meeting_id_position_key;
alter table public.meeting_items add constraint meeting_items_meeting_id_position_key unique(meeting_id,position) deferrable initially immediate;
-- Explicit allowlist; auth, permissions, audit and worker queues are never restored.
create or replace function public.backup_tables_v64() returns text[] language sql immutable as $$
 select array['song_collections','songs','categories','bible_versions','bible_books','bible_verses','bible_references','song_files','song_sources','song_sections','song_categories','song_bible_references','meetings','meeting_items','meeting_share_links','public_meeting_contributions','external_sources','external_song_refs','song_link_imports','youth_key_reference_v46','youth_key_applied_v46'];
$$;
revoke all on function public.backup_tables_v64() from public,anon,authenticated;
create table if not exists public.restore_tickets_v64(id uuid primary key default gen_random_uuid(),actor uuid not null, payload_hash text not null,state_hash text not null,expires_at timestamptz not null default now()+interval '1 hour',used boolean not null default false);
alter table public.restore_tickets_v64 enable row level security;
revoke all on public.restore_tickets_v64 from public,anon,authenticated;
create or replace function public.backup_state_v64() returns jsonb language plpgsql security definer set search_path=public as $$
declare t text;rows jsonb;result jsonb:='{}';begin
 foreach t in array public.backup_tables_v64() loop
 execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb) from public.%I x',t) into rows;
 result:=result||jsonb_build_object(t,rows);
 end loop;return result;
end $$;
revoke all on function public.backup_state_v64() from public,anon,authenticated;
create or replace function public.export_package_v64(p_meeting uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare data jsonb;info jsonb:='{}';t text;rows jsonb;ids uuid[];fids uuid[];cids uuid[];begin
 if public.current_user_role() is null or (p_meeting is null and not public.is_admin()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_meeting is null then
 data:=public.backup_state_v64();
 foreach t in array array['profiles','activity_log_v48','external_sync_runs','song_merge_history_v47','book_repair_backups_v57'] loop
 execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x',t) into rows;info:=info||jsonb_build_object(t,rows);
 end loop;
 else
 if not exists(select 1 from public.meetings where id=p_meeting) then raise exception 'Program inexistent.';end if;
 select array_agg(distinct song_id) into ids from public.meeting_items where meeting_id=p_meeting and song_id is not null;
 select array_agg(id) into fids from public.song_files where song_id=any(ids) or id in(select source_file_id from public.song_sources where song_id=any(ids));
 select array_agg(distinct collection_id) into cids from (select collection_id from public.song_sources where song_id=any(ids) union select collection_id from public.song_files where id=any(fids)) x;
 data:=jsonb_build_object(
 'meetings',(select jsonb_agg(to_jsonb(m)) from public.meetings m where id=p_meeting),
 'meeting_items',(select coalesce(jsonb_agg(to_jsonb(m) order by is_backup,position),'[]') from public.meeting_items m where meeting_id=p_meeting),
 'songs',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.songs s where id=any(ids)),
 'song_files',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from public.song_files f where id=any(fids)),
 'song_sources',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.song_sources s where song_id=any(ids)),
 'song_sections',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.song_sections s where song_id=any(ids)),
 'song_collections',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.song_collections c where id=any(cids)));
 end if;
 insert into public.activity_log_v48(actor_id,event_type,details) values(auth.uid(),case when p_meeting is null then 'backup_export' else 'program_export' end,jsonb_build_object('meeting_id',p_meeting));
 return jsonb_build_object('format','songapp-package','version',64,'kind',case when p_meeting is null then 'backup' else 'program' end,'createdAt',now(),'tables',data,'referenceOnly',info);
end $$;
revoke all on function public.export_package_v64(uuid) from public,anon;
grant execute on function public.export_package_v64(uuid) to authenticated;

-- One transaction, original IDs, no deletion. Both preview and commit execute the same validation.
create or replace function public.restore_rows_v64(p_tables jsonb,p_check_files boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare t text;r jsonb;oldrow jsonb;cols text;updates text;pk text;predicate text;keycols text[];allowedcols text[];usercols text[];k text;details jsonb:='[]';summary jsonb:='[]';added int;changed int;unchanged int;fields jsonb;v text;duplicates boolean;begin
 if not public.is_admin() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if jsonb_typeof(p_tables)<>'object' or p_tables='{}'::jsonb then raise exception 'Date de backup invalide.';end if;
 for t in select jsonb_object_keys(p_tables) loop
 if not(t=any(public.backup_tables_v64())) or jsonb_typeof(p_tables->t)<>'array' then raise exception 'Tabel neacceptat: %',t;end if;
 end loop;
 -- Categories may refer to parents appearing later in the archive.
 set constraints all deferred;
 foreach t in array public.backup_tables_v64() loop
 if not(p_tables ? t) then continue;end if;
 select array_agg(a.attname order by u.ordinality) into keycols from pg_index i cross join lateral unnest(i.indkey) with ordinality u(attnum,ordinality) join pg_attribute a on a.attrelid=i.indrelid and a.attnum=u.attnum where i.indrelid=('public.'||t)::regclass and i.indisprimary;
 select string_agg(format('%I',c.column_name),',' order by c.ordinal_position),string_agg(format('%1$I=excluded.%1$I',c.column_name),',' order by c.ordinal_position) filter(where not(c.column_name=any(keycols))) into cols,updates from information_schema.columns c where c.table_schema='public' and c.table_name=t and c.is_generated='NEVER';
 select array_agg(column_name),array_agg(column_name) filter(where column_name=any(array['created_by','imported_by','reviewed_by'])) into allowedcols,usercols from information_schema.columns where table_schema='public' and table_name=t;
 select string_agg(format('%I',x),',') into pk from unnest(keycols) x;
 select string_agg(format('to_jsonb(x)->%L=$1->%L',x,x),' and ') into predicate from unnest(keycols) x;
 execute format('select exists(select 1 from jsonb_array_elements($1) x group by %s having count(*)>1)',(select string_agg(format('x->%L',x),',') from unnest(keycols) x)) into duplicates using p_tables->t;
 if duplicates then raise exception 'Identificatori dublați în %',t;end if;
 added:=0;changed:=0;unchanged:=0;
 for r in select value from jsonb_array_elements(p_tables->t) loop
 if jsonb_typeof(r)<>'object' then raise exception 'Înregistrare invalidă în %',t;end if;
 foreach k in array keycols loop if r->>k is null then raise exception 'Identificator lipsă în %',t;end if;end loop;
 if exists(select 1 from jsonb_object_keys(r) x where not(x=any(allowedcols))) then raise exception 'Coloane necunoscute în %. Folosește aceeași versiune a aplicației.',t;end if;
 -- Account identities are not portable. Preserve only existing references, never create users.
 foreach k in array coalesce(usercols,array[]::text[]) loop
 if r->>k is not null and not exists(select 1 from public.profiles where id=(r->>k)::uuid) then r:=jsonb_set(r,array[k],'null');end if;
 end loop;
 execute format('select to_jsonb(x) from public.%I x where %s',t,predicate) into oldrow using r;
 -- Ignore generated search values and volatile timestamps when describing actual changes.
 select coalesce(jsonb_agg(key order by key),'[]') into fields from jsonb_each(r) where key not in('updated_at','search_text','search_vector','program_revision') and value is distinct from oldrow->key;
 if oldrow is not null and fields='[]'::jsonb then unchanged:=unchanged+1;continue;end if;
 if oldrow is null then added:=added+1;else changed:=changed+1;end if;
 details:=details||jsonb_build_array(jsonb_build_object('table',t,'id',coalesce(r->>'id',r->>'song_id',r->>'source_key',r->>'normalized_title'),'label',coalesce(r->>'title',r->>'name',r->>'file_name',r->>'custom_title',r->>'id',r->>'song_id'),'action',case when oldrow is null then 'add' else 'update' end,'fields',fields,'before',(select coalesce(jsonb_object_agg(key,left(value::text,300)),'{}') from jsonb_each(coalesce(oldrow,'{}')) where fields ? key),'after',(select coalesce(jsonb_object_agg(key,left(value::text,300)),'{}') from jsonb_each(r) where fields ? key)));
 if t='song_files' and p_check_files then
 foreach k in array array['storage_path','preview_path_v58'] loop v:=r->>k;if nullif(v,'') is not null and not exists(select 1 from storage.objects where bucket_id='song-files' and name=v) then raise exception 'Fișier neîncărcat: %',v;end if;end loop;
 end if;
 -- Parent references are set in a second pass, avoiding input-order dependence.
 if t='categories' then r:=jsonb_set(r,'{parent_id}','null');end if;
 execute format('insert into public.%1$I(%2$s) select %2$s from jsonb_populate_record(null::public.%1$I,$1) on conflict(%3$s) do %4$s',t,cols,pk,case when updates is null then 'nothing' else 'update set '||updates end) using r;
 end loop;
 if t='categories' then
 for r in select value from jsonb_array_elements(p_tables->t) loop update public.categories set parent_id=(r->>'parent_id')::uuid where id=(r->>'id')::uuid;end loop;
 end if;
 summary:=summary||jsonb_build_array(jsonb_build_object('table',t,'added',added,'changed',changed,'unchanged',unchanged));
 end loop;
 return jsonb_build_object('summary',summary,'changes',details);
end $$;
revoke all on function public.restore_rows_v64(jsonb,boolean) from public,anon,authenticated;
create or replace function public.restore_package_v64(p_tables jsonb,p_ticket uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare t text;report jsonb;ticket public.restore_tickets_v64;statehash text;payloadhash text;begin
 if not public.is_admin() then raise exception 'Acces interzis.' using errcode='42501';end if;
 -- Block concurrent writes between validation and commit; also covers editor/public RPC mutations.
 foreach t in array public.backup_tables_v64() loop execute format('lock table public.%I in share row exclusive mode',t);end loop;
 statehash:=md5(public.backup_state_v64()::text);payloadhash:=md5(p_tables::text);
 if p_ticket is null then
 begin
 report:=public.restore_rows_v64(p_tables,false);
 raise exception 'preview rollback' using errcode='P0064';
 exception when sqlstate 'P0064' then null;end;
 delete from public.restore_tickets_v64 where expires_at<now();
 insert into public.restore_tickets_v64(actor,payload_hash,state_hash) values(auth.uid(),payloadhash,statehash) returning * into ticket;
 return report||jsonb_build_object('ticket',ticket.id,'expiresAt',ticket.expires_at);
 end if;
 select * into ticket from public.restore_tickets_v64 where id=p_ticket for update;
 if ticket.id is null or ticket.actor<>auth.uid() or ticket.used or ticket.expires_at<now() or ticket.payload_hash<>payloadhash or ticket.state_hash<>statehash then raise exception 'Preview expirat sau date modificate între timp. Generează un preview nou.';end if;
 report:=public.restore_rows_v64(p_tables,true);
 update public.restore_tickets_v64 set used=true where id=ticket.id;
 insert into public.activity_log_v48(actor_id,event_type,details) values(auth.uid(),'backup_restore',jsonb_build_object('ticket',ticket.id,'summary',report->'summary'));
 return report||jsonb_build_object('restored',true);
end $$;
revoke all on function public.restore_package_v64(jsonb,uuid) from public,anon;
grant execute on function public.restore_package_v64(jsonb,uuid) to authenticated;
commit;
