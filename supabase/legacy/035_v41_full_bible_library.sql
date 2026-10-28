-- v41: Full local Bible library for verse suggestions
-- Creates a complete Bible storage layer and local search helpers.

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
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.bible_books (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.bible_versions(id) on delete cascade,
  book_order int not null,
  osis_code text not null,
  name text not null,
  normalized_name text generated always as (lower(public.unaccent(name))) stored,
  testament text not null check (testament in ('old','new')),
  unique(version_id, osis_code),
  unique(version_id, book_order)
);

create table if not exists public.bible_verses (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.bible_versions(id) on delete cascade,
  book_id uuid not null references public.bible_books(id) on delete cascade,
  book_order int not null,
  chapter int not null,
  verse int not null,
  text text not null,
  normalized_text text generated always as (lower(public.unaccent(text))) stored,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', public.unaccent(coalesce(text, ''))), 'A')
  ) stored,
  unique(version_id, book_id, chapter, verse)
);

create index if not exists bible_verses_version_book_chapter_idx
  on public.bible_verses(version_id, book_order, chapter, verse);

create index if not exists bible_verses_search_gin_idx
  on public.bible_verses using gin(search_vector);

create index if not exists bible_verses_text_trgm_idx
  on public.bible_verses using gin(normalized_text gin_trgm_ops);

alter table public.bible_versions enable row level security;
alter table public.bible_books enable row level security;
alter table public.bible_verses enable row level security;

-- Read access for authenticated users and anonymous public pages.
drop policy if exists bible_versions_read on public.bible_versions;
create policy bible_versions_read on public.bible_versions for select using (true);

drop policy if exists bible_books_read on public.bible_books;
create policy bible_books_read on public.bible_books for select using (true);

drop policy if exists bible_verses_read on public.bible_verses;
create policy bible_verses_read on public.bible_verses for select using (true);

-- Write access only for active admin/editor profiles.
drop policy if exists bible_versions_write on public.bible_versions;
create policy bible_versions_write on public.bible_versions for all using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

drop policy if exists bible_books_write on public.bible_books;
create policy bible_books_write on public.bible_books for all using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

drop policy if exists bible_verses_write on public.bible_verses;
create policy bible_verses_write on public.bible_verses for all using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

insert into public.bible_versions (code, name, language, source_name, source_url, license_label, license_url, is_default)
values (
  'RCCV',
  'Protestant Romanian Corrected Cornilescu Version',
  'ro',
  'seven1m/open-bibles',
  'https://github.com/seven1m/open-bibles/blob/master/ron-rccv.usfx.xml',
  'Public Domain',
  'https://github.com/seven1m/open-bibles',
  true
)
on conflict (code) do update set
  name = excluded.name,
  language = excluded.language,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  license_label = excluded.license_label,
  license_url = excluded.license_url,
  is_default = true;

create or replace function public.search_bible_verses(
  p_query text,
  p_limit int default 20,
  p_version_code text default 'RCCV'
)
returns table (
  verse_id uuid,
  reference_label text,
  book_name text,
  chapter int,
  verse int,
  text text,
  rank real
)
language sql
stable
as $$
  with v as (
    select id from public.bible_versions where code = p_version_code limit 1
  ), q as (
    select public.unaccent(coalesce(p_query, '')) as raw_query
  )
  select
    bv.id as verse_id,
    bb.name || ' ' || bv.chapter || ':' || bv.verse as reference_label,
    bb.name as book_name,
    bv.chapter,
    bv.verse,
    bv.text,
    (
      ts_rank_cd(bv.search_vector, websearch_to_tsquery('simple', q.raw_query))
      + case when bv.normalized_text ilike '%' || lower(q.raw_query) || '%' then 0.5 else 0 end
      + similarity(bv.normalized_text, lower(q.raw_query))
    )::real as rank
  from public.bible_verses bv
  join public.bible_books bb on bb.id = bv.book_id
  join v on v.id = bv.version_id
  cross join q
  where length(trim(q.raw_query)) > 1
    and (
      bv.search_vector @@ websearch_to_tsquery('simple', q.raw_query)
      or bv.normalized_text ilike '%' || lower(q.raw_query) || '%'
      or similarity(bv.normalized_text, lower(q.raw_query)) > 0.12
    )
  order by rank desc, bv.book_order, bv.chapter, bv.verse
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create or replace function public.get_bible_reference_text(
  p_book text,
  p_chapter int,
  p_verse_start int,
  p_verse_end int default null,
  p_version_code text default 'RCCV'
)
returns table (
  reference_label text,
  text text,
  source_url text,
  license_label text
)
language sql
stable
as $$
  with version_row as (
    select * from public.bible_versions where code = p_version_code limit 1
  ), book_row as (
    select b.*
    from public.bible_books b
    join version_row v on v.id = b.version_id
    where b.normalized_name = lower(public.unaccent(p_book))
       or lower(b.osis_code) = lower(p_book)
    limit 1
  ), verses as (
    select bv.*
    from public.bible_verses bv
    join book_row b on b.id = bv.book_id
    where bv.chapter = p_chapter
      and bv.verse between p_verse_start and coalesce(p_verse_end, p_verse_start)
    order by bv.verse
  )
  select
    b.name || ' ' || p_chapter || ':' || p_verse_start || case when coalesce(p_verse_end, p_verse_start) <> p_verse_start then '-' || p_verse_end else '' end,
    string_agg(verses.verse || '. ' || verses.text, E'\n' order by verses.verse),
    v.source_url,
    v.license_label
  from verses
  cross join book_row b
  cross join version_row v
  group by b.name, v.source_url, v.license_label;
$$;

create or replace function public.bible_library_stats()
returns table (
  version_code text,
  version_name text,
  books_count bigint,
  verses_count bigint,
  old_testament_verses bigint,
  new_testament_verses bigint
)
language sql
stable
as $$
  select
    v.code,
    v.name,
    count(distinct b.id) as books_count,
    count(bv.id) as verses_count,
    count(bv.id) filter (where b.testament = 'old') as old_testament_verses,
    count(bv.id) filter (where b.testament = 'new') as new_testament_verses
  from public.bible_versions v
  left join public.bible_books b on b.version_id = v.id
  left join public.bible_verses bv on bv.book_id = b.id
  group by v.code, v.name
  order by v.code;
$$;

notify pgrst, 'reload schema';
