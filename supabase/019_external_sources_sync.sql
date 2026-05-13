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
