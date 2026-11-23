begin;

-- Propunerile deja aflate în așteptare devin elemente normale ale wishlistului.
with pending as(
 select c.id,c.playlist_id,c.song_id,c.notes,p.created_by,
   coalesce((select max(i.position) from public.rehearsal_playlist_items_v84 i where i.playlist_id=c.playlist_id),0)
   +row_number() over(partition by c.playlist_id order by c.created_at,c.id) as new_position
 from public.public_wishlist_contributions_v103 c
 join public.rehearsal_playlists_v84 p on p.id=c.playlist_id
 where c.status='pending'
   and not exists(select 1 from public.rehearsal_playlist_items_v84 i where i.playlist_id=c.playlist_id and i.song_id=c.song_id)
),inserted as(
 insert into public.rehearsal_playlist_items_v84(playlist_id,song_id,position,notes,created_by)
 select playlist_id,song_id,new_position,nullif(btrim(notes),''),created_by from pending
 on conflict(playlist_id,song_id) do nothing returning playlist_id
)
update public.rehearsal_playlists_v84 p set updated_at=now()
where p.id in(select playlist_id from inserted);

update public.public_wishlist_contributions_v103
set status='accepted',reviewed_at=coalesce(reviewed_at,now()) where status='pending';

-- Vizitatorul adaugă direct în wishlist. Tabela de contribuții rămâne jurnalul
-- tehnic pentru limite și deduplicare, dar nu mai creează o coadă de aprobare.
create or replace function public.add_public_wishlist_contribution_v103(
 p_slug text,p_song uuid,p_contributor_name text default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_playlist uuid;v_owner uuid;v_item uuid;v_position integer;v_now timestamptz:=clock_timestamp();
begin
 if length(coalesce(p_slug,''))>200 or length(coalesce(p_contributor_name,''))>120 or length(coalesce(p_notes,''))>1000 then raise exception 'Datele propunerii sunt prea lungi.';end if;
 select id,created_by into v_playlist,v_owner from public.rehearsal_playlists_v84 where public_slug=p_slug and is_public for update;
 if v_playlist is null then raise exception 'Wishlistul public nu este disponibil.' using errcode='42501';end if;
 if not exists(select 1 from public.songs where id=p_song and is_active) then raise exception 'Cântarea nu există.';end if;
 select id into v_item from public.rehearsal_playlist_items_v84 where playlist_id=v_playlist and song_id=p_song;
 if v_item is not null then return v_item;end if;
 if (select count(*) from public.public_wishlist_contributions_v103 where playlist_id=v_playlist and created_at>v_now-interval '1 minute')>=20 then raise exception 'Prea multe adăugări. Reîncearcă peste un minut.';end if;
 if (select count(*) from public.public_wishlist_contributions_v103 where playlist_id=v_playlist and created_at>v_now-interval '1 hour')>=200 then raise exception 'Limita orară de adăugări a fost atinsă.';end if;
 select coalesce(max(position),0)+1 into v_position from public.rehearsal_playlist_items_v84 where playlist_id=v_playlist;
 insert into public.rehearsal_playlist_items_v84(playlist_id,song_id,position,notes,created_by)
 values(v_playlist,p_song,v_position,nullif(btrim(p_notes),''),v_owner) returning id into v_item;
 insert into public.public_wishlist_contributions_v103(playlist_id,song_id,contributor_name,notes,status,reviewed_at)
 values(v_playlist,p_song,nullif(btrim(p_contributor_name),''),nullif(btrim(p_notes),''),'accepted',v_now);
 update public.rehearsal_playlists_v84 set updated_at=v_now where id=v_playlist;
 return v_item;
end $$;

revoke all on function public.add_public_wishlist_contribution_v103(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.add_public_wishlist_contribution_v103(text,uuid,text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
