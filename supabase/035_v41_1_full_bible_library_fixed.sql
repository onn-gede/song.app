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
