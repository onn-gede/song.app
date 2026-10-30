begin;
-- Keep the existing RPC signature for installed clients; this is now one bounded selection.
create or replace function public.list_public_programs_v66(p_page integer default 1,p_page_size integer default 4) returns jsonb language sql stable security definer set search_path=public as $$
with eligible as materialized(
 select m.id,m.title,m.meeting_date,l.public_slug,
 case when m.meeting_date<=now() and m.meeting_date+interval '2 hours'>now() then 'in_progress' when m.meeting_date>now() then 'planned' else 'finished' end as phase
 from public.meetings m join lateral(select public_slug from public.meeting_share_links where meeting_id=m.id and is_active and (expires_at is null or expires_at>now()) order by created_at desc,id limit 1) l on true
 where not m.is_template and m.status<>'archived'
),latest as(select *,0 as slot from eligible where meeting_date<=now() order by meeting_date desc,id limit 1),
 upcoming as(select *,1 as slot from eligible where meeting_date>now() order by meeting_date,id limit 4),
 chosen as(select * from (select * from latest union all select * from upcoming) x order by slot,meeting_date,id limit 4)
select jsonb_build_object('total',(select count(*) from chosen),'page',1,'pageSize',4,
 'programs',coalesce((select jsonb_agg(jsonb_build_object('title',title,'date',meeting_date,'slug',public_slug,'phase',phase) order by slot,meeting_date,id) from chosen),'[]'));
$$;
revoke all on function public.list_public_programs_v66(integer,integer) from public;
grant execute on function public.list_public_programs_v66(integer,integer) to anon,authenticated;
commit;
