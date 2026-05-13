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
