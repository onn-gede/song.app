-- După v63, pe aceeași bază.
begin;
-- Allow an archived order to swap existing positions atomically. Primary ID remains immediate.
alter table public.meeting_items drop constraint if exists meeting_items_meeting_id_position_key;
alter table public.meeting_items add constraint meeting_items_meeting_id_position_key unique(meeting_id,position) deferrable initially immediate;
-- Explicit allowlist; auth, permissions, audit and worker queues are never restored.
create or replace function public.backup_tables_v64() returns text[] language sql immutable as $$
 select array['song_collections','songs','categories','bible_versions','bible_books','bible_verses','bible_references','song_files','song_sources','song_sections','song_categories','song_bible_references','meetings','meeting_items','meeting_share_links','public_meeting_contributions','external_sources','external_song_refs','song_link_imports','youth_key_reference_v46','youth_key_applied_v46'];
$$;
revoke all on function public.backup_tables_v64() from public,anon,authenticated;
create table if not exists public.restore_tickets_v64(id uuid primary key default gen_random_uuid(),actor uuid not null, payload_hash text not null,state_hash text not null,expires_at timestamptz not null default now()+interval '1 hour',used boolean not null default false);
alter table public.restore_tickets_v64 enable row level security;
revoke all on public.restore_tickets_v64 from public,anon,authenticated;
create or replace function public.backup_state_v64() returns jsonb language plpgsql security definer set search_path=public as $$
declare t text;rows jsonb;result jsonb:='{}';begin
 foreach t in array public.backup_tables_v64() loop
 execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb) from public.%I x',t) into rows;
 result:=result||jsonb_build_object(t,rows);
 end loop;return result;
end $$;
revoke all on function public.backup_state_v64() from public,anon,authenticated;
create or replace function public.export_package_v64(p_meeting uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare data jsonb;info jsonb:='{}';t text;rows jsonb;ids uuid[];fids uuid[];cids uuid[];begin
 if public.current_user_role() is null or (p_meeting is null and not public.is_admin()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_meeting is null then
 data:=public.backup_state_v64();
 foreach t in array array['profiles','activity_log_v48','external_sync_runs','song_merge_history_v47','book_repair_backups_v57'] loop
 execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x',t) into rows;info:=info||jsonb_build_object(t,rows);
 end loop;
 else
 if not exists(select 1 from public.meetings where id=p_meeting) then raise exception 'Program inexistent.';end if;
 select array_agg(distinct song_id) into ids from public.meeting_items where meeting_id=p_meeting and song_id is not null;
 select array_agg(id) into fids from public.song_files where song_id=any(ids) or id in(select source_file_id from public.song_sources where song_id=any(ids));
 select array_agg(distinct collection_id) into cids from (select collection_id from public.song_sources where song_id=any(ids) union select collection_id from public.song_files where id=any(fids)) x;
 data:=jsonb_build_object(
 'meetings',(select jsonb_agg(to_jsonb(m)) from public.meetings m where id=p_meeting),
 'meeting_items',(select coalesce(jsonb_agg(to_jsonb(m) order by is_backup,position),'[]') from public.meeting_items m where meeting_id=p_meeting),
 'songs',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.songs s where id=any(ids)),
 'song_files',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from public.song_files f where id=any(fids)),
 'song_sources',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.song_sources s where song_id=any(ids)),
 'song_sections',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.song_sections s where song_id=any(ids)),
 'song_collections',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.song_collections c where id=any(cids)));
 end if;
 insert into public.activity_log_v48(actor_id,event_type,details) values(auth.uid(),case when p_meeting is null then 'backup_export' else 'program_export' end,jsonb_build_object('meeting_id',p_meeting));
 return jsonb_build_object('format','songapp-package','version',64,'kind',case when p_meeting is null then 'backup' else 'program' end,'createdAt',now(),'tables',data,'referenceOnly',info);
end $$;
revoke all on function public.export_package_v64(uuid) from public,anon;
grant execute on function public.export_package_v64(uuid) to authenticated;

-- One transaction, original IDs, no deletion. Both preview and commit execute the same validation.
create or replace function public.restore_rows_v64(p_tables jsonb,p_check_files boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare t text;r jsonb;oldrow jsonb;cols text;updates text;pk text;predicate text;keycols text[];allowedcols text[];usercols text[];k text;details jsonb:='[]';summary jsonb:='[]';added int;changed int;unchanged int;fields jsonb;v text;duplicates boolean;begin
 if not public.is_admin() then raise exception 'Acces interzis.' using errcode='42501';end if;
 if jsonb_typeof(p_tables)<>'object' or p_tables='{}'::jsonb then raise exception 'Date de backup invalide.';end if;
 for t in select jsonb_object_keys(p_tables) loop
 if not(t=any(public.backup_tables_v64())) or jsonb_typeof(p_tables->t)<>'array' then raise exception 'Tabel neacceptat: %',t;end if;
 end loop;
 -- Categories may refer to parents appearing later in the archive.
 set constraints all deferred;
 foreach t in array public.backup_tables_v64() loop
 if not(p_tables ? t) then continue;end if;
 select array_agg(a.attname order by u.ordinality) into keycols from pg_index i cross join lateral unnest(i.indkey) with ordinality u(attnum,ordinality) join pg_attribute a on a.attrelid=i.indrelid and a.attnum=u.attnum where i.indrelid=('public.'||t)::regclass and i.indisprimary;
 select string_agg(format('%I',c.column_name),',' order by c.ordinal_position),string_agg(format('%1$I=excluded.%1$I',c.column_name),',' order by c.ordinal_position) filter(where not(c.column_name=any(keycols))) into cols,updates from information_schema.columns c where c.table_schema='public' and c.table_name=t and c.is_generated='NEVER';
 select array_agg(column_name),array_agg(column_name) filter(where column_name=any(array['created_by','imported_by','reviewed_by'])) into allowedcols,usercols from information_schema.columns where table_schema='public' and table_name=t;
 select string_agg(format('%I',x),',') into pk from unnest(keycols) x;
 select string_agg(format('to_jsonb(x)->%L=$1->%L',x,x),' and ') into predicate from unnest(keycols) x;
 execute format('select exists(select 1 from jsonb_array_elements($1) x group by %s having count(*)>1)',(select string_agg(format('x->%L',x),',') from unnest(keycols) x)) into duplicates using p_tables->t;
 if duplicates then raise exception 'Identificatori dublați în %',t;end if;
 added:=0;changed:=0;unchanged:=0;
 for r in select value from jsonb_array_elements(p_tables->t) loop
 if jsonb_typeof(r)<>'object' then raise exception 'Înregistrare invalidă în %',t;end if;
 foreach k in array keycols loop if r->>k is null then raise exception 'Identificator lipsă în %',t;end if;end loop;
 if exists(select 1 from jsonb_object_keys(r) x where not(x=any(allowedcols))) then raise exception 'Coloane necunoscute în %. Folosește aceeași versiune a aplicației.',t;end if;
 -- Account identities are not portable. Preserve only existing references, never create users.
 foreach k in array coalesce(usercols,array[]::text[]) loop
 if r->>k is not null and not exists(select 1 from public.profiles where id=(r->>k)::uuid) then r:=jsonb_set(r,array[k],'null');end if;
 end loop;
 execute format('select to_jsonb(x) from public.%I x where %s',t,predicate) into oldrow using r;
 -- Ignore generated search values and volatile timestamps when describing actual changes.
 select coalesce(jsonb_agg(key order by key),'[]') into fields from jsonb_each(r) where key not in('updated_at','search_text','search_vector','program_revision') and value is distinct from oldrow->key;
 if oldrow is not null and fields='[]'::jsonb then unchanged:=unchanged+1;continue;end if;
 if oldrow is null then added:=added+1;else changed:=changed+1;end if;
 details:=details||jsonb_build_array(jsonb_build_object('table',t,'id',coalesce(r->>'id',r->>'song_id',r->>'source_key',r->>'normalized_title'),'label',coalesce(r->>'title',r->>'name',r->>'file_name',r->>'custom_title',r->>'id',r->>'song_id'),'action',case when oldrow is null then 'add' else 'update' end,'fields',fields,'before',(select coalesce(jsonb_object_agg(key,left(value::text,300)),'{}') from jsonb_each(coalesce(oldrow,'{}')) where fields ? key),'after',(select coalesce(jsonb_object_agg(key,left(value::text,300)),'{}') from jsonb_each(r) where fields ? key)));
 if t='song_files' and p_check_files then
 foreach k in array array['storage_path','preview_path_v58'] loop v:=r->>k;if nullif(v,'') is not null and not exists(select 1 from storage.objects where bucket_id='song-files' and name=v) then raise exception 'Fișier neîncărcat: %',v;end if;end loop;
 end if;
 -- Parent references are set in a second pass, avoiding input-order dependence.
 if t='categories' then r:=jsonb_set(r,'{parent_id}','null');end if;
 execute format('insert into public.%1$I(%2$s) select %2$s from jsonb_populate_record(null::public.%1$I,$1) on conflict(%3$s) do %4$s',t,cols,pk,case when updates is null then 'nothing' else 'update set '||updates end) using r;
 end loop;
 if t='categories' then
 for r in select value from jsonb_array_elements(p_tables->t) loop update public.categories set parent_id=(r->>'parent_id')::uuid where id=(r->>'id')::uuid;end loop;
 end if;
 summary:=summary||jsonb_build_array(jsonb_build_object('table',t,'added',added,'changed',changed,'unchanged',unchanged));
 end loop;
 return jsonb_build_object('summary',summary,'changes',details);
end $$;
revoke all on function public.restore_rows_v64(jsonb,boolean) from public,anon,authenticated;
create or replace function public.restore_package_v64(p_tables jsonb,p_ticket uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare t text;report jsonb;ticket public.restore_tickets_v64;statehash text;payloadhash text;begin
 if not public.is_admin() then raise exception 'Acces interzis.' using errcode='42501';end if;
 -- Block concurrent writes between validation and commit; also covers editor/public RPC mutations.
 foreach t in array public.backup_tables_v64() loop execute format('lock table public.%I in share row exclusive mode',t);end loop;
 statehash:=md5(public.backup_state_v64()::text);payloadhash:=md5(p_tables::text);
 if p_ticket is null then
 begin
 report:=public.restore_rows_v64(p_tables,false);
 raise exception 'preview rollback' using errcode='P0064';
 exception when sqlstate 'P0064' then null;end;
 delete from public.restore_tickets_v64 where expires_at<now();
 insert into public.restore_tickets_v64(actor,payload_hash,state_hash) values(auth.uid(),payloadhash,statehash) returning * into ticket;
 return report||jsonb_build_object('ticket',ticket.id,'expiresAt',ticket.expires_at);
 end if;
 select * into ticket from public.restore_tickets_v64 where id=p_ticket for update;
 if ticket.id is null or ticket.actor<>auth.uid() or ticket.used or ticket.expires_at<now() or ticket.payload_hash<>payloadhash or ticket.state_hash<>statehash then raise exception 'Preview expirat sau date modificate între timp. Generează un preview nou.';end if;
 report:=public.restore_rows_v64(p_tables,true);
 update public.restore_tickets_v64 set used=true where id=ticket.id;
 insert into public.activity_log_v48(actor_id,event_type,details) values(auth.uid(),'backup_restore',jsonb_build_object('ticket',ticket.id,'summary',report->'summary'));
 return report||jsonb_build_object('restored',true);
end $$;
revoke all on function public.restore_package_v64(jsonb,uuid) from public,anon;
grant execute on function public.restore_package_v64(jsonb,uuid) to authenticated;
commit;
