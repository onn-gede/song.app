-- DOAR CITIRE. Rulează în SQL Editor al proiectului SongApp existent.
-- Confirmă metadatele și existența obiectelor, nu recalculează hash-ul binarelor.
-- Colecția este identificată prin cheia stabilă, chiar dacă ai redenumit-o.
with catalog as (
 select id,name from public.song_collections
 where presentation_catalog_key_v58='black-book-ppt' and is_active
), files as (
 select f.*,c.name as collection_name,
 exists(select 1 from storage.objects o where o.bucket_id='song-files' and o.name=f.storage_path) as original_exists,
 exists(select 1 from storage.objects o where o.bucket_id='song-files' and o.name=f.preview_path_v58) as pdf_exists
 from public.song_files f join catalog c on c.id=f.collection_id where f.presentation_only_v58
), expected as (
 select lpad(n::text,3,'0') as num from generate_series(1,803) n
)
select (select count(*) from catalog) as colectii_ppt,
 (select count(*) from files) as total_inregistrari,
 (select count(distinct song_id) from files) as cantari_distincte,
 (select count(*) from files where upload_complete_v58 and original_exists and pdf_exists) as complete_cu_ppt_si_pdf,
 (select count(*) from files where not upload_complete_v58 or not original_exists or not pdf_exists) as incomplete,
 (select array_agg(num order by num) from expected e where not exists(select 1 from files f where f.source_number_v58=e.num)) as numere_lipsa,
 (select array_agg(source_number_v58 order by source_number_v58) from files where source_number_v58 not in(select num from expected)) as numere_neasteptate;
-- Așteptat: 1 / 803 / 803 / 803 / 0 / NULL / NULL.

-- Linkurile publice existente: permite verificarea motivului pentru linkurile vechi cu 404.
select public_slug,is_active,allow_contributions,expires_at,
 (is_active and (expires_at is null or expires_at>now())) as activ_acum
from public.meeting_share_links
where public_slug in ('joi-28-10-f17978','duminica-dimineata-1-11-13ec76');
