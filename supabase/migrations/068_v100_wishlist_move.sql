begin;

-- Mută atomic o cântare din wishlist într-un program activ. Dacă adăugarea
-- eșuează, elementul rămâne în wishlist.
create or replace function public.move_wishlist_song_to_meeting_v100(
  p_playlist uuid,
  p_item uuid,
  p_meeting uuid,
  p_is_backup boolean default false,
  p_selected_key text default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_song uuid;
  v_notes text;
  v_title text;
begin
  if not public.can_edit_content() then
    raise exception 'Acces interzis.' using errcode='42501';
  end if;

  perform 1 from public.rehearsal_playlists_v84 where id=p_playlist for update;
  if not found then raise exception 'Wishlistul nu există.'; end if;

  select i.song_id,i.notes,s.title into v_song,v_notes,v_title
  from public.rehearsal_playlist_items_v84 i
  join public.songs s on s.id=i.song_id and s.is_active
  where i.id=p_item and i.playlist_id=p_playlist
  for update of i;
  if v_song is null then raise exception 'Cântarea nu mai este în wishlist.'; end if;

  perform 1 from public.meetings
  where id=p_meeting and coalesce(is_template,false)=false and status<>'archived'
    and meeting_date+interval '2 hours'>now()
  for update;
  if not found then raise exception 'Programul nu mai este activ sau viitor.'; end if;

  perform public.add_program_song_v52(
    p_meeting_id=>p_meeting,
    p_song_id=>v_song,
    p_is_backup=>coalesce(p_is_backup,false),
    p_source_id=>null,
    p_selected_key=>nullif(btrim(p_selected_key),''),
    p_notes=>v_notes
  );

  delete from public.rehearsal_playlist_items_v84
  where id=p_item and playlist_id=p_playlist;

  with ordered as(
    select id,row_number() over(order by position,id) pos
    from public.rehearsal_playlist_items_v84 where playlist_id=p_playlist
  )
  update public.rehearsal_playlist_items_v84 i
  set position=100000+ordered.pos from ordered where i.id=ordered.id;
  update public.rehearsal_playlist_items_v84 set position=position-100000 where playlist_id=p_playlist;
  update public.rehearsal_playlists_v84 set updated_at=now() where id=p_playlist;

  insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id,details)
  values(auth.uid(),'wishlist.move_to_program','meetings',p_meeting::text,
    jsonb_build_object('resource_label',v_title,'playlist_id',p_playlist,'song_id',v_song,'is_backup',coalesce(p_is_backup,false)));

  return public.get_rehearsal_playlist_v84(p_playlist);
end $$;

revoke all on function public.move_wishlist_song_to_meeting_v100(uuid,uuid,uuid,boolean,text) from public,anon;
grant execute on function public.move_wishlist_song_to_meeting_v100(uuid,uuid,uuid,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
