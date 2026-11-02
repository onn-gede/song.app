begin;
-- Keep old clients compatible while sharing all link checks, limits and deduplication.
-- Exactly nine typed arguments select the protected overload, never this wrapper.
create or replace function public.add_public_meeting_contribution(
 p_public_slug text,
 p_contribution_type text default 'song',
 p_song_id uuid default null,
 p_custom_title text default null,
 p_custom_text text default null,
 p_is_backup boolean default false,
 p_contributor_name text default null,
 p_notes text default null
) returns uuid language sql security invoker set search_path=public as $$
 select public.add_public_meeting_contribution(
   p_public_slug::text,p_contribution_type::text,p_song_id::uuid,
   p_custom_title::text,p_custom_text::text,p_is_backup::boolean,
   null::integer,p_contributor_name::text,p_notes::text
 );
$$;
revoke all on function public.add_public_meeting_contribution(text,text,uuid,text,text,boolean,text,text) from public;
grant execute on function public.add_public_meeting_contribution(text,text,uuid,text,text,boolean,text,text) to anon,authenticated;
-- Some deployed databases contain this helper, others do not. Do not create a new API.
do $$ begin
 if to_regprocedure('public.bulk_update_import_status(uuid[],public.import_status)') is not null then
  revoke execute on function public.bulk_update_import_status(uuid[],public.import_status) from public,anon;
  grant execute on function public.bulk_update_import_status(uuid[],public.import_status) to authenticated;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
