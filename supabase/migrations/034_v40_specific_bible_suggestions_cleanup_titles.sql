-- v40: curăță titlul/numărul cântării din song_sections și reconstruiește lyrics_text.
-- Rulează o dată după update ca să cureți importurile vechi.

create or replace function public.normalize_song_line_for_cleanup(value text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        translate(lower(coalesce(value, '')), 'ăâîșşțţ', 'aaisstt'),
        '^[[:space:][:digit:].\-–—_#:/()\[\]]+', '', 'g'
      ),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

create or replace function public.cleanup_repeated_song_titles_in_sections()
returns table(updated_songs integer, updated_sections integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  section_record record;
  cleaned_content text;
  changed_sections integer := 0;
  changed_songs integer := 0;
begin
  create temp table if not exists _songs_to_rebuild(song_id uuid primary key) on commit drop;
  truncate table _songs_to_rebuild;

  for section_record in
    select
      ss.id,
      ss.song_id,
      ss.content,
      s.title,
      coalesce(array_agg(src.song_number) filter (where src.song_number is not null), '{}') as numbers
    from public.song_sections ss
    join public.songs s on s.id = ss.song_id
    left join public.song_sources src on src.song_id = s.id
    group by ss.id, ss.song_id, ss.content, s.title
  loop
    with lines as (
      select line, ord
      from regexp_split_to_table(coalesce(section_record.content, ''), E'\r?\n') with ordinality as t(line, ord)
    ), cleaned as (
      select line, ord
      from lines
      where not (
        public.normalize_song_line_for_cleanup(line) <> ''
        and (
          replace(public.normalize_song_line_for_cleanup(line), ' ', '') = replace(public.normalize_song_line_for_cleanup(section_record.title), ' ', '')
          or exists (
            select 1
            from unnest(section_record.numbers) n
            where replace(public.normalize_song_line_for_cleanup(line), ' ', '') in (
              replace(public.normalize_song_line_for_cleanup(n), ' ', ''),
              replace(public.normalize_song_line_for_cleanup(n || ' ' || section_record.title), ' ', ''),
              replace(public.normalize_song_line_for_cleanup(section_record.title || ' ' || n), ' ', '')
            )
          )
        )
      )
    )
    select trim(regexp_replace(string_agg(line, E'\n' order by ord), E'\n{3,}', E'\n\n', 'g'))
    into cleaned_content
    from cleaned;

    cleaned_content := coalesce(cleaned_content, '');

    if cleaned_content is distinct from coalesce(section_record.content, '') then
      update public.song_sections
      set content = cleaned_content
      where id = section_record.id;
      changed_sections := changed_sections + 1;
      insert into _songs_to_rebuild(song_id) values (section_record.song_id)
      on conflict do nothing;
    end if;
  end loop;

  delete from public.song_sections where trim(coalesce(content, '')) = '';

  for section_record in select song_id from _songs_to_rebuild loop
    update public.songs s
    set lyrics_text = coalesce((
      select string_agg(trim(ss.content), E'\n\n' order by ss.position)
      from public.song_sections ss
      where ss.song_id = section_record.song_id and trim(coalesce(ss.content, '')) <> ''
    ), s.lyrics_text)
    where s.id = section_record.song_id;
    changed_songs := changed_songs + 1;
  end loop;

  updated_songs := changed_songs;
  updated_sections := changed_sections;
  return next;
end;
$$;

select * from public.cleanup_repeated_song_titles_in_sections();
notify pgrst, 'reload schema';
