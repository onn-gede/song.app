begin;
-- Use the same per-meeting lock and global ordering as drag/drop. The legacy
-- per-group position shift collided with the other list's unique positions.
create or replace function public.accept_public_meeting_contribution(p_contribution_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.public_meeting_contributions; mid uuid; result uuid; before_id uuid; note text;
begin
 if not public.can_edit_content() then raise exception 'Nu ai permisiunea să accepți propuneri.' using errcode='42501';end if;
 select meeting_id into mid from public.public_meeting_contributions where id=p_contribution_id;
 if mid is null then raise exception 'Propunerea nu există.';end if;
 perform 1 from public.meetings where id=mid for update;
 select * into c from public.public_meeting_contributions where id=p_contribution_id for update;
 if not found then raise exception 'Propunerea nu mai există.';end if;
 if c.status<>'pending' then raise exception 'Propunerea a fost deja procesată.';end if;
 if c.proposed_position is not null then
  select id into before_id from public.meeting_items where meeting_id=mid and is_backup=c.is_backup order by position,id offset greatest(c.proposed_position-1,0) limit 1;
 end if;
 note:=concat_ws(E'\n',nullif(c.notes,''),'Adăugată din link public'||case when nullif(c.contributor_name,'') is not null then ' de '||c.contributor_name else '' end);
 if c.song_id is not null then
  if not exists(select 1 from public.songs where id=c.song_id and is_active) then raise exception 'Cântarea propusă nu mai este disponibilă.';end if;
  result:=public.add_song_to_meeting(mid,c.song_id,c.is_backup,null,note);
 else
  if c.contribution_type='song' then raise exception 'Cântarea propusă nu mai este disponibilă.';end if;
  result:=public.add_text_to_meeting(mid,c.contribution_type,c.custom_title,c.custom_text);
  update public.meeting_items set notes=nullif(note,'') where id=result;
 end if;
 perform public.place_meeting_item_v45(mid,result,c.is_backup,before_id);
 update public.public_meeting_contributions set status='accepted',reviewed_at=now(),reviewed_by=auth.uid() where id=c.id;
 return result;
end $$;
revoke all on function public.accept_public_meeting_contribution(uuid) from public,anon;
grant execute on function public.accept_public_meeting_contribution(uuid) to authenticated;

create or replace function public.program_notifications_v54(p_meeting_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if not exists(select 1 from public.meetings where id=p_meeting_id) then raise exception 'Program inexistent.' using errcode='P0002';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'contribution_type',c.contribution_type,'custom_title',c.custom_title,'custom_text',c.custom_text,'is_backup',c.is_backup,'proposed_position',c.proposed_position,'contributor_name',c.contributor_name,'notes',c.notes,'created_at',c.created_at,'songs',case when s.id is null then null else jsonb_build_object('id',s.id,'title',s.title,'default_key',s.default_key) end) order by c.created_at,c.id),'[]'::jsonb)
 into result from public.public_meeting_contributions c left join public.songs s on s.id=c.song_id where c.meeting_id=p_meeting_id and c.status='pending';
 return result;
end $$;
revoke all on function public.program_notifications_v54(uuid) from public,anon;
grant execute on function public.program_notifications_v54(uuid) to authenticated;

-- One request for mutation + confirmed state. Avoid re-rendering the entire
-- detail page (history/share/usage queries) before the browser can see a change.
create or replace function public.set_program_common_v54(p_meeting_id uuid,p_item_id uuid,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_enabled is null then raise exception 'Marcaj invalid.';end if;
 perform 1 from public.meetings where id=p_meeting_id for update;
 update public.meeting_items set is_congregational=p_enabled where id=p_item_id and meeting_id=p_meeting_id and song_id is not null;
 if not found then raise exception 'Cântarea nu mai există în acest program.' using errcode='P0002';end if;
 return public.get_meeting_snapshot_v46(p_meeting_id);
end $$;
revoke all on function public.set_program_common_v54(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_program_common_v54(uuid,uuid,boolean) to authenticated;

create or replace function public.review_program_contribution_v54(p_meeting_id uuid,p_contribution_id uuid,p_accept boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.public_meeting_contributions;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_accept is null then raise exception 'Acțiune invalidă.';end if;
 perform 1 from public.meetings where id=p_meeting_id for update;
 select * into c from public.public_meeting_contributions where id=p_contribution_id and meeting_id=p_meeting_id for update;
 if not found then raise exception 'Propunerea nu mai există în acest program.' using errcode='P0002';end if;
 -- Retried requests never insert a duplicate or reverse a prior decision.
 if c.status='pending' then
  if p_accept then perform public.accept_public_meeting_contribution(c.id);
  else perform public.reject_public_meeting_contribution(c.id);end if;
 end if;
 return jsonb_build_object('snapshot',public.get_meeting_snapshot_v46(p_meeting_id),'pending',public.program_notifications_v54(p_meeting_id));
end $$;
revoke all on function public.review_program_contribution_v54(uuid,uuid,boolean) from public,anon;
grant execute on function public.review_program_contribution_v54(uuid,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
