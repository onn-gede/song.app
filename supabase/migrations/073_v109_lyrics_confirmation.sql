begin;

create table if not exists public.song_lyrics_confirmations_v109(
  song_id uuid primary key references public.songs(id) on delete cascade,
  candidate_hash text not null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz not null default now()
);
alter table public.song_lyrics_confirmations_v109 enable row level security;
revoke all on public.song_lyrics_confirmations_v109 from public,anon,authenticated;
grant select on public.song_lyrics_confirmations_v109 to authenticated;
grant all on public.song_lyrics_confirmations_v109 to service_role;
drop policy if exists song_lyrics_confirmations_read_v109 on public.song_lyrics_confirmations_v109;
create policy song_lyrics_confirmations_read_v109
  on public.song_lyrics_confirmations_v109 for select to authenticated
  using(public.current_user_role() is not null);

create or replace function public.youth_lyric_candidate_v106(p_song uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare v_result jsonb;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  select candidate into v_result
  from (
    select jsonb_build_object(
      'id',s.id,'title',s.title,'number',src.song_number,'sectionId',v.id,
      'before',coalesce(v.content,s.lyrics_text),'after',s.title||E'\n'||coalesce(v.content,s.lyrics_text),
      'hash',md5(jsonb_build_array(s.title,s.lyrics_text,v.id,v.content)::text)
    ) candidate
    from public.songs s
    join lateral(
      select ss.song_number
      from public.song_sources ss
      join public.song_collections c on c.id=ss.collection_id
      where ss.song_id=s.id and (upper(c.short_code)='TINERI' or lower(c.name)='tineri')
      order by ss.id limit 1
    ) src on true
    left join lateral(
      select id,content from public.song_sections
      where song_id=s.id and section_type='verse'
      order by position,id limit 1
    ) v on true
    where s.id=p_song and s.is_active and length(trim(s.title))>=4
      and nullif(trim(coalesce(v.content,s.lyrics_text)),'') is not null
      and public.normalize_song_title_for_duplicates(split_part(regexp_replace(coalesce(v.content,s.lyrics_text),'^[[:space:]]*[0-9]+[.): -]+','','i'),E'\n',1))
          <>public.normalize_song_title_for_duplicates(s.title)
      and not exists(
        select 1 from regexp_split_to_table(coalesce(v.content,s.lyrics_text),E'\n') ln
        where public.normalize_song_title_for_duplicates(regexp_replace(ln,'^[[:space:]]*[0-9]+[.): -]+','','i'))
              =public.normalize_song_title_for_duplicates(s.title)
      )
      and not exists(
        select 1 from public.youth_lyric_repairs_v65 b where b.song_id=s.id and b.reverted_at is null
      )
  ) candidates
  where not exists(
    select 1 from public.song_lyrics_confirmations_v109 c
    where c.song_id=p_song and c.candidate_hash=candidates.candidate->>'hash'
  );
  return v_result;
end $$;
revoke all on function public.youth_lyric_candidate_v106(uuid) from public,anon;
grant execute on function public.youth_lyric_candidate_v106(uuid) to authenticated;

create or replace function public.confirm_song_lyrics_v109(p_song uuid,p_hash text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare v_candidate jsonb;
begin
  if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
  perform 1 from public.songs where id=p_song for update;
  if not found then raise exception 'Cântarea nu mai există.'; end if;
  v_candidate:=public.youth_lyric_candidate_v106(p_song);
  if v_candidate is null or v_candidate->>'hash' is distinct from p_hash then
    raise exception 'Versurile au fost modificate sau nu mai necesită confirmare.';
  end if;
  insert into public.song_lyrics_confirmations_v109(song_id,candidate_hash,confirmed_by,confirmed_at)
  values(p_song,p_hash,auth.uid(),now())
  on conflict(song_id) do update set
    candidate_hash=excluded.candidate_hash,
    confirmed_by=excluded.confirmed_by,
    confirmed_at=excluded.confirmed_at;
  insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id,details)
  values(auth.uid(),'lyrics.confirm','songs',p_song::text,jsonb_build_object('candidate_hash',p_hash));
  return true;
end $$;
revoke all on function public.confirm_song_lyrics_v109(uuid,text) from public,anon;
grant execute on function public.confirm_song_lyrics_v109(uuid,text) to authenticated;

create or replace function public.backup_tables_v64() returns text[] language sql immutable as $$
 select array['song_collections','program_moment_style_v80','songs','rehearsal_playlists_v84','rehearsal_playlist_items_v84','public_wishlist_contributions_v103','categories','bible_versions','bible_books','bible_verses','bible_references','song_files','song_sources','song_sections','song_categories','song_bible_references','meetings','meeting_items','meeting_share_links','public_meeting_contributions','external_sources','external_song_refs','song_link_imports','youth_key_reference_v46','youth_key_applied_v46','song_usage_exclusions_v65','youth_lyric_repairs_v65','song_lyrics_confirmations_v109'];
$$;
revoke all on function public.backup_tables_v64() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
