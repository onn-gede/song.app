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
