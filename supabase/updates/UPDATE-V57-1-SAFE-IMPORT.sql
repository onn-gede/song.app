-- SongApp v57.1: protecție pentru baza existentă după UPDATE-V57.sql.
-- Nu importă, nu șterge, nu arhivează și nu dezactivează cântări.
begin;
do $$ begin
 if to_regprocedure('public.upsert_book_song_payload_v57_1(text,text,text,text,jsonb,jsonb,text)') is null then
  if to_regprocedure('public.upsert_book_song_v57(text,text,text,text,jsonb,jsonb,text)') is null then raise exception 'Rulează mai întâi UPDATE-V57.sql în aceeași bază.';end if;
  alter function public.upsert_book_song_v57(text,text,text,text,jsonb,jsonb,text) rename to upsert_book_song_payload_v57_1;
 end if;
end $$;
-- Payload-ul vechi rămâne privat. Apelurile publice trec prin protecția de mai jos.
revoke all on function public.upsert_book_song_payload_v57_1(text,text,text,text,jsonb,jsonb,text) from public,anon,authenticated,service_role;
create or replace function public.upsert_book_song_v57(p_code text,p_title text,p_number text,p_lyrics text,p_sections jsonb,p_source_ids jsonb,p_url text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_code='cn' then raise exception 'Importul parțial Carte Neagră din v57 este blocat. Este necesar catalogul verificat 001–805 și importatorul pentru ediția completă.';end if;
 return public.upsert_book_song_payload_v57_1(p_code,p_title,p_number,p_lyrics,p_sections,p_source_ids,p_url);
end $$;
revoke all on function public.upsert_book_song_v57(text,text,text,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.upsert_book_song_v57(text,text,text,text,jsonb,jsonb,text) to authenticated,service_role;
-- Finalizarea verifică numai identitățile confirmate. Nu mai mută sau dezactivează surse/piese.
create or replace function public.finalize_book_catalog_v57(p_code text,p_song_ids jsonb,p_expected integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid;ids uuid[];confirmed integer;required integer;
begin
 if not(coalesce(auth.role()='service_role',false) or public.can_edit_content()) then raise exception 'Acces interzis.' using errcode='42501';end if;
 if p_code is null or p_code not in ('cr','cn') or jsonb_typeof(p_song_ids) is distinct from 'array' then raise exception 'Catalog invalid.';end if;
 required:=case p_code when 'cr' then 601 else 805 end;
 if p_expected is distinct from required then raise exception 'Catalog incomplet: sunt necesare % cântări. Nu s-a arhivat nimic.',required;end if;
 select array_agg(distinct v::uuid) into ids from jsonb_array_elements_text(p_song_ids) v;
 if cardinality(ids) is distinct from required then raise exception 'Catalog incomplet: nu s-a arhivat nimic.';end if;
 cid:=(public.book_collection_v57(p_code)->>'id')::uuid;
 select count(distinct s.id) into confirmed from public.song_sources ss join public.songs s on s.id=ss.song_id where ss.collection_id=cid and s.id=any(ids) and s.is_active;
 if confirmed<>required then raise exception 'Import incomplet: nu s-a arhivat nimic.';end if;
 if exists(select 1 from generate_series(1,required) n where not exists(select 1 from public.song_sources ss where ss.collection_id=cid and ss.song_id=any(ids) and public.song_number_fold_v57(ss.song_number)=n::text)) then raise exception 'Numerotarea nu acoperă toate cele % poziții.',required;end if;
 return jsonb_build_object('songs',confirmed,'archivedSources',0,'archivalDisabled',true);
end $$;
revoke all on function public.finalize_book_catalog_v57(text,jsonb,integer) from public,anon;
grant execute on function public.finalize_book_catalog_v57(text,jsonb,integer) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
