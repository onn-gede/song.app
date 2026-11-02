begin;

-- "Momente" behaves like one visual collection. One color is applied to every
-- existing and future non-song item, instead of storing unrelated item colors.
create table if not exists public.program_moment_style_v80(
 id smallint primary key default 1 check(id=1),
 name text not null default 'Momente',
 color text not null default '#d97706' check(color ~ '^#[0-9A-Fa-f]{6}$'),
 opacity integer not null default 100 check(opacity in(25,50,75,100)),
 updated_at timestamptz not null default now()
);
alter table public.program_moment_style_v80 enable row level security;
drop policy if exists moment_style_read_v80 on public.program_moment_style_v80;
create policy moment_style_read_v80 on public.program_moment_style_v80 for select to authenticated using(public.current_user_role() is not null);
revoke all on public.program_moment_style_v80 from public,anon,authenticated;
grant select on public.program_moment_style_v80 to authenticated;
grant all on public.program_moment_style_v80 to service_role;

insert into public.program_moment_style_v80(id,color,opacity)
select 1,coalesce((select moment_color from public.meeting_items where song_id is null group by moment_color order by count(*) desc,moment_color limit 1),'#d97706'),100
on conflict(id) do nothing;

alter table public.meeting_items add column if not exists moment_opacity integer not null default 100 check(moment_opacity in(25,50,75,100));
update public.meeting_items mi set moment_color=s.color,moment_opacity=s.opacity from public.program_moment_style_v80 s where mi.song_id is null and(mi.moment_color is distinct from s.color or mi.moment_opacity is distinct from s.opacity);

create or replace function public.apply_program_moment_style_v80() returns trigger language plpgsql security definer set search_path=public as $$
declare style public.program_moment_style_v80;
begin
 if new.song_id is null then
  select * into style from public.program_moment_style_v80 where id=1;
  new.moment_color:=coalesce(style.color,'#d97706');new.moment_opacity:=coalesce(style.opacity,100);
 end if;
 return new;
end $$;
revoke all on function public.apply_program_moment_style_v80() from public,anon,authenticated;
drop trigger if exists apply_program_moment_style_v80 on public.meeting_items;
create trigger apply_program_moment_style_v80 before insert or update of song_id,moment_color,moment_opacity on public.meeting_items for each row execute function public.apply_program_moment_style_v80();

-- The anonymous program payload exposes the global moment intensity as well.
create or replace function public.get_shared_meeting_v79(p_public_slug text) returns jsonb language sql stable security definer set search_path=public as $$
 with base as(select public.get_shared_meeting(p_public_slug) data), enriched as(
  select coalesce(jsonb_agg(item||jsonb_build_object('moment_opacity',mi.moment_opacity) order by ord),'[]'::jsonb) items
  from base cross join lateral jsonb_array_elements(coalesce(base.data->'items','[]'::jsonb)) with ordinality as rows(item,ord)
  left join public.meeting_items mi on mi.id=nullif(item->>'id','')::uuid
 )
 select case when base.data is null then null else jsonb_set(jsonb_set(base.data,'{meeting}',(base.data->'meeting')||jsonb_build_object('program_kind',m.program_kind),true),'{items}',enriched.items,true) end
 from base left join public.meeting_share_links l on l.public_slug=p_public_slug and l.is_active and(l.expires_at is null or l.expires_at>now())
 left join public.meetings m on m.id=l.meeting_id cross join enriched;
$$;

create or replace function public.set_program_moment_style_v80(p_color text,p_opacity integer default 100) returns jsonb language plpgsql security definer set search_path=public as $$
declare result public.program_moment_style_v80;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_color is null or p_color !~ '^#[0-9A-Fa-f]{6}$' or p_opacity not in(25,50,75,100) then raise exception 'Culoare sau intensitate invalidă.';end if;
 update public.program_moment_style_v80 set color=lower(p_color),opacity=p_opacity,updated_at=now() where id=1 returning * into result;
 update public.meeting_items set moment_color=result.color,moment_opacity=result.opacity where song_id is null and(moment_color is distinct from result.color or moment_opacity is distinct from result.opacity);
 insert into public.activity_log_v48(actor_id,event_type,resource_type,resource_id,details) values(auth.uid(),'moment.style_update','program_moment_style_v80','1',jsonb_build_object('fields',jsonb_build_array('color','opacity'),'after',jsonb_build_object('color',result.color,'opacity',result.opacity),'resource_label','Momente'));
 return to_jsonb(result);
end $$;

create or replace function public.admin_update_profile_v80(p_id uuid,p_name text,p_role text,p_active boolean) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if public.current_user_role()<>'admin' then raise exception 'Doar administratorii pot modifica utilizatori.' using errcode='42501';end if;
 if nullif(btrim(p_name),'') is null or length(btrim(p_name))>120 then raise exception 'Numele afișat este obligatoriu și poate avea maximum 120 de caractere.';end if;
 perform public.admin_set_profile_v48(p_id,p_role,p_active);
 update public.profiles set full_name=btrim(p_name),updated_at=now() where id=p_id;
 if not found then raise exception 'Utilizatorul nu există.';end if;
 return true;
end $$;

-- Collection-number suggestion uses released numbers first, then the next
-- numeric value while preserving the collection's zero padding.
create or replace function public.next_song_numbers_v80() returns table(collection_id uuid,next_number text) language plpgsql stable security definer set search_path=public as $$
begin
 if public.current_user_role() is null then raise exception 'Autentificare necesară.' using errcode='42501';end if;
 return query
 with stats as(
  select c.id,
   max(ss.song_number::numeric) filter(where ss.song_number ~ '^[0-9]+$') max_number,
   max(length(ss.song_number)) filter(where ss.song_number ~ '^0[0-9]+$') padded_width
  from public.song_collections c left join public.song_sources ss on ss.collection_id=c.id where c.is_active group by c.id
 )
 select st.id,coalesce(
  (select r.number from public.reusable_song_numbers_v78 r where r.collection_id=st.id and not exists(select 1 from public.song_sources used where used.collection_id=st.id and public.song_number_fold_v57(used.song_number)=public.song_number_fold_v57(r.number)) order by case when r.number ~ '^[0-9]+$' then r.number::numeric end nulls last,r.number limit 1),
  lpad((coalesce(st.max_number,0)+1)::text,greatest(coalesce(st.padded_width,1),length((coalesce(st.max_number,0)+1)::text)),'0')
 ) from stats st;
end $$;

-- Backups include the global moment collection setting.
create or replace function public.backup_tables_v64() returns text[] language sql immutable as $$
 select array['song_collections','program_moment_style_v80','songs','categories','bible_versions','bible_books','bible_verses','bible_references','song_files','song_sources','song_sections','song_categories','song_bible_references','meetings','meeting_items','meeting_share_links','public_meeting_contributions','external_sources','external_song_refs','song_link_imports','youth_key_reference_v46','youth_key_applied_v46'];
$$;

revoke all on function public.set_program_moment_style_v80(text,integer),public.admin_update_profile_v80(uuid,text,text,boolean),public.next_song_numbers_v80(),public.backup_tables_v64() from public,anon;
grant execute on function public.set_program_moment_style_v80(text,integer),public.admin_update_profile_v80(uuid,text,text,boolean),public.next_song_numbers_v80() to authenticated;
notify pgrst,'reload schema';
commit;
