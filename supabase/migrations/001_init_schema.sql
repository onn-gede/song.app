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
