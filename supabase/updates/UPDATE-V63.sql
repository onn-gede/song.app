-- După v62, în aceeași bază.
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
