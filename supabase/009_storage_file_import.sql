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
