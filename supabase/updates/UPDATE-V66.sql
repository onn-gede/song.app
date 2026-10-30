-- După v65, pe aceeași bază. Nu modifică utilizatori sau sesiuni în bază.
begin;
create or replace function public.list_public_programs_v66(p_page integer default 1,p_page_size integer default 4) returns jsonb language sql stable security definer set search_path=public as $$
with eligible as materialized(
 select m.id,m.title,m.meeting_date,l.public_slug,
 case when m.meeting_date<=now() and m.meeting_date+interval '2 hours'>now() then 0 when m.meeting_date>now() then 1 else 2 end as sort_phase
 from public.meetings m join lateral(select public_slug from public.meeting_share_links where meeting_id=m.id and is_active and (expires_at is null or expires_at>now()) order by created_at desc,id limit 1) l on true
 where not m.is_template and m.status<>'archived'
),page_rows as(select * from eligible order by sort_phase,case when sort_phase<2 then meeting_date end asc,case when sort_phase=2 then meeting_date end desc,id
 limit least(greatest(coalesce(p_page_size,4),1),12) offset (least(greatest(coalesce(p_page,1),1),100000)::bigint-1)*least(greatest(coalesce(p_page_size,4),1),12))
select jsonb_build_object('total',(select count(*) from eligible),'page',least(greatest(coalesce(p_page,1),1),100000),'pageSize',least(greatest(coalesce(p_page_size,4),1),12),
 'programs',coalesce((select jsonb_agg(jsonb_build_object('title',title,'date',meeting_date,'slug',public_slug,'phase',case sort_phase when 0 then 'in_progress' when 1 then 'planned' else 'finished' end) order by sort_phase,case when sort_phase<2 then meeting_date end asc,case when sort_phase=2 then meeting_date end desc,id) from page_rows),'[]'));
$$;
revoke all on function public.list_public_programs_v66(integer,integer) from public;
grant execute on function public.list_public_programs_v66(integer,integer) to anon,authenticated;
create or replace function public.create_meeting_share_link_v66(p_meeting_id uuid,p_preferred_slug text default null,p_allow_contributions boolean default true) returns text language plpgsql security definer set search_path=public as $$
declare slug text;begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_allow_contributions is null then raise exception 'Setare de acces invalidă.';end if;
 slug:=public.create_meeting_share_link(p_meeting_id,p_preferred_slug);
 update public.meeting_share_links set allow_contributions=p_allow_contributions where meeting_id=p_meeting_id and public_slug=slug;
 return slug;
end $$;
revoke all on function public.create_meeting_share_link_v66(uuid,text,boolean) from public,anon;
grant execute on function public.create_meeting_share_link_v66(uuid,text,boolean) to authenticated;
-- Enable visitor suggestions for the current/upcoming already published programs once.
-- A later manual opt-out is preserved when this migration is run again.
create table if not exists public.release_flags_v66(key text primary key);
alter table public.release_flags_v66 enable row level security;
revoke all on public.release_flags_v66 from public,anon,authenticated;
grant all on public.release_flags_v66 to service_role;
alter table public.meeting_share_links alter column allow_contributions set default true;
do $$begin
 if not exists(select 1 from public.release_flags_v66 where key='visitor_suggestions') then
 update public.meeting_share_links l set allow_contributions=true from public.meetings m where m.id=l.meeting_id and l.is_active and (l.expires_at is null or l.expires_at>now()) and not m.is_template and m.status<>'archived' and m.meeting_date+interval '2 hours'>now();
 insert into public.release_flags_v66(key) values('visitor_suggestions') on conflict do nothing;
 end if;
end $$;
commit;
