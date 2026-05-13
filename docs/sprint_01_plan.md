# Sprint 0.1 - Fundatie aplicatie cantari

## Scop

Sa avem o baza de date stabila si un import-test din PPTX, inainte sa construim interfata.

## Ce facem in acest sprint

1. Cream proiect Supabase.
2. Rulam schema initiala.
3. Cream user admin.
4. Importam cele 21 de cantari din arhiva Tineret ca test.
5. Verificam cautarea dupa titlu/versuri.
6. Verificam functia de istoric pentru ultimele 30 de zile.
7. Pregatim frontend-ul Next.js.

## Verificari dupa import

Ruleaza in Supabase SQL Editor:

```sql
select count(*) from public.songs;
select count(*) from public.song_sections;
select * from public.search_songs('furtuni viata', 10);
```

## Test intalnire + evidentiere 30 zile

Dupa import, poti testa manual:

```sql
insert into public.meetings (title, meeting_type, meeting_date, status)
values ('Duminica dimineata - test', 'duminica-dimineata', now(), 'draft');

insert into public.meeting_items (meeting_id, position, item_type, song_id)
select m.id, 1, 'song', s.id
from public.meetings m, public.songs s
where m.title = 'Duminica dimineata - test'
  and s.title ilike '%furtuni%'
limit 1;

select * from public.get_song_recent_usage(30);
```

## Observatii pentru import PPTX

Importul este intentionat conservator. Nu incercam sa „reparam” automat toate versurile, pentru ca unele fisiere au structura diferita. Pasul corect este:

1. import brut;
2. preview CSV;
3. corectare in UI sau printr-un editor intern;
4. marcare cantare ca verificata/aprobata.
