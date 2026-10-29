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
