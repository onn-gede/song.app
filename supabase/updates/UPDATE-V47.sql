-- ACTUALIZARE v45/v46 → v47 pe ACELAȘI proiect Supabase. Include dependențele și raportul gamelor din v46.
begin;
-- Revision guards live client state against a delayed/stale route render.
alter table public.meetings add column if not exists program_revision bigint not null default 0;
create or replace function public.bump_program_revision_v46() returns trigger language plpgsql set search_path=public as $$
begin new.program_revision := old.program_revision + 1; return new; end $$;
drop trigger if exists meetings_revision_v46 on public.meetings;
create trigger meetings_revision_v46 before update on public.meetings for each row execute function public.bump_program_revision_v46();
create or replace function public.touch_program_items_v46() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op <> 'INSERT' then update public.meetings set updated_at=now() where id=old.meeting_id; end if;
  if tg_op='INSERT' or (tg_op='UPDATE' and new.meeting_id<>old.meeting_id) then
    update public.meetings set updated_at=now() where id=new.meeting_id;
  end if;
  return null;
end $$;
drop trigger if exists meeting_items_revision_v46 on public.meeting_items;
create trigger meeting_items_revision_v46 after insert or update or delete on public.meeting_items for each row execute function public.touch_program_items_v46();
create or replace function public.get_meeting_snapshot_v46(p_meeting_id uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object('revision',m.program_revision,'principal',m.principal_responsible,'secondary',m.secondary_responsibles,
    'items',coalesce((select jsonb_agg(to_jsonb(mi)||jsonb_build_object('songs',
      case when s.id is null then null else jsonb_build_object('id',s.id,'title',s.title,'lyrics_text',s.lyrics_text,'default_key',s.default_key,'bpm',s.bpm,'structure',s.structure) end) order by mi.position,mi.id)
    from public.meeting_items mi left join public.songs s on s.id=mi.song_id where mi.meeting_id=m.id),'[]'::jsonb))
  from public.meetings m where m.id=p_meeting_id;
$$;
revoke all on function public.get_meeting_snapshot_v46(uuid) from public,anon;
grant execute on function public.get_meeting_snapshot_v46(uuid) to authenticated;

-- One occurrence per real meeting. Backups, templates and future dates are excluded.
create or replace view public.song_performance_occurrences_v46 with (security_invoker=true) as
select distinct mi.song_id,m.id as meeting_id,m.title as meeting_title,m.meeting_date,m.meeting_type
from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
where mi.song_id is not null and not mi.is_backup and not m.is_template and m.meeting_date<=now();
revoke all on public.song_performance_occurrences_v46 from public,anon;
grant select on public.song_performance_occurrences_v46 to authenticated;
create index if not exists meeting_items_performance_v46 on public.meeting_items(song_id,meeting_id) where song_id is not null and not is_backup;

create or replace function public.get_song_history_v46(p_song_id uuid,p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security invoker set search_path=public as $$
with uses as materialized (select * from public.song_performance_occurrences_v46 where song_id=p_song_id),
rows as (select * from uses order by meeting_date desc,meeting_id limit least(greatest(coalesce(p_page_size,30),1),100) offset (greatest(coalesce(p_page,1),1)::bigint-1)*least(greatest(coalesce(p_page_size,30),1),100))
select jsonb_build_object('total',(select count(*) from uses),'last_used_at',(select max(meeting_date) from uses),
  'entries',coalesce((select jsonb_agg(to_jsonb(rows) order by meeting_date desc,meeting_id) from rows),'[]'::jsonb));
$$;
revoke all on function public.get_song_history_v46(uuid,integer,integer) from public,anon;
grant execute on function public.get_song_history_v46(uuid,integer,integer) to authenticated;

create or replace function public.list_song_library_v46(
  p_collection uuid default null, p_category uuid default null, p_number text default null,
  p_status text default null, p_key text default null, p_sort text default 'title_asc',
  p_page integer default 1, p_page_size integer default 50, p_query text default null
) returns jsonb language sql stable security invoker set search_path = public as $$
with usage as materialized (
  select song_id,count(*) as times_sung,max(meeting_date) as last_used_at
  from public.song_performance_occurrences_v46 group by song_id
), filtered as materialized (
  select s.id,s.title,s.default_key,s.bpm,s.structure,s.created_at,coalesce(u.times_sung,0) as times_sung,u.last_used_at,
    (select min(nullif(regexp_replace(src.song_number,'[^0-9]','','g'),'')::numeric)
       from public.song_sources src where src.song_id=s.id
       and (p_collection is null or src.collection_id=p_collection)) as source_number
  from public.songs s left join usage u on u.song_id=s.id
  where s.is_active
    and (p_sort is distinct from 'most_sung' or coalesce(u.times_sung,0)>0)
    and (nullif(trim(p_query),'') is null
      or s.search_vector @@ plainto_tsquery('simple',public.unaccent(p_query))
      or s.search_text ilike '%'||lower(public.unaccent(p_query))||'%'
      or exists(select 1 from public.song_sources ss where ss.song_id=s.id and
        (ss.song_number ilike '%'||p_query||'%' or lower(public.unaccent(coalesce(ss.source_title,''))) ilike '%'||lower(public.unaccent(p_query))||'%')))
    and (p_key is null or s.default_key=p_key)
    and (p_collection is null or exists(select 1 from public.song_sources src where src.song_id=s.id and src.collection_id=p_collection))
    and (p_category is null or exists(select 1 from public.song_categories c where c.song_id=s.id and c.category_id=p_category))
    and (nullif(trim(p_number),'') is null or exists(select 1 from public.song_sources src where src.song_id=s.id and (src.song_number ilike '%'||p_number||'%' or src.source_title ilike '%'||p_number||'%')))
    and (p_status is null or exists(select 1 from public.song_files f where f.song_id=s.id and f.import_status::text=p_status))
), paged as (
  select * from filtered
  order by
    case when p_sort='most_sung' then times_sung end desc nulls last,
    case when p_sort in ('most_sung','last_sung') then last_used_at end desc nulls last,
    case when p_sort='created_desc' then created_at end desc,
    case when p_sort='source_number_asc' then source_number end asc nulls last,
    case when p_sort='source_number_desc' then source_number end desc nulls last,
    case when p_sort='title_desc' then title end desc,
    case when p_sort<>'title_desc' then title end asc,
    id
  limit least(greatest(coalesce(p_page_size,50),1),100)
  offset (greatest(coalesce(p_page,1),1)::bigint-1)*least(greatest(coalesce(p_page_size,50),1),100)
)
select jsonb_build_object(
  'total',(select count(*) from filtered),
  'keys',(select coalesce(jsonb_agg(k.default_key order by k.default_key),'[]'::jsonb) from (select distinct default_key from public.songs where is_active and default_key is not null) k),
  'songs',coalesce((select jsonb_agg(to_jsonb(p)-'source_number' || jsonb_build_object(
    'song_sources',(select coalesce(jsonb_agg(jsonb_build_object('song_number',ss.song_number,'source_title',ss.source_title,'song_collections',jsonb_build_object('id',sc.id,'name',sc.name,'short_code',sc.short_code)) order by sc.name,ss.song_number,ss.id),'[]'::jsonb) from public.song_sources ss left join public.song_collections sc on sc.id=ss.collection_id where ss.song_id=p.id),
    'song_categories',(select coalesce(jsonb_agg(jsonb_build_object('categories',jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug)) order by c.name),'[]'::jsonb) from public.song_categories x join public.categories c on c.id=x.category_id where x.song_id=p.id),
    'song_files',(select coalesce(jsonb_agg(jsonb_build_object('import_status',sf.import_status) order by sf.created_at,sf.id),'[]'::jsonb) from public.song_files sf where sf.song_id=p.id)
  )) from paged p),'[]'::jsonb)
);
$$;
revoke all on function public.list_song_library_v46(uuid,uuid,text,text,text,text,integer,integer,text) from public,anon;
grant execute on function public.list_song_library_v46(uuid,uuid,text,text,text,text,integer,integer,text) to authenticated;

create or replace function public.get_song_recent_usage(days_back integer default 30)
returns table(song_id uuid,title text,last_used_at timestamptz,times_used bigint,last_meeting_title text)
language sql stable security invoker set search_path=public as $$
with ranked as (
 select o.*,s.title,row_number() over(partition by o.song_id order by o.meeting_date desc,o.meeting_id) as rn
 from public.song_performance_occurrences_v46 o join public.songs s on s.id=o.song_id
 where o.meeting_date>=now()-make_interval(days=>greatest(coalesce(days_back,30),0))
 
) select song_id,title,max(meeting_date),count(*),max(meeting_title) filter(where rn=1) from ranked group by song_id,title order by max(meeting_date) desc;
$$;

create or replace function public.get_song_recent_usage_excluding_meeting(days_back integer default 30, excluded_meeting_id uuid default null)
returns table(song_id uuid,title text,last_used_at timestamptz,times_used bigint,last_meeting_title text)
language sql stable security invoker set search_path=public as $$
with ranked as (
 select o.*,s.title,row_number() over(partition by o.song_id order by o.meeting_date desc,o.meeting_id) as rn
 from public.song_performance_occurrences_v46 o join public.songs s on s.id=o.song_id
 where o.meeting_date>=now()-make_interval(days=>greatest(coalesce(days_back,30),0))
 and (excluded_meeting_id is null or o.meeting_id<>excluded_meeting_id)
) select song_id,title,max(meeting_date),count(*),max(meeting_title) filter(where rn=1) from ranked group by song_id,title order by max(meeting_date) desc;
$$;
notify pgrst,'reload schema';
commit;

begin;
create table if not exists public.youth_key_reference_v46 (
 reference_number text primary key, title text not null, musical_key text, original_notation text not null
);
alter table public.youth_key_reference_v46 enable row level security;
drop policy if exists youth_key_reference_read on public.youth_key_reference_v46;
create policy youth_key_reference_read on public.youth_key_reference_v46 for select to authenticated using (exists(select 1 from public.profiles where id=auth.uid() and is_active));
grant select on public.youth_key_reference_v46 to authenticated;
insert into public.youth_key_reference_v46(reference_number,title,musical_key,original_notation) values
('1','Am fost nascut in pacat','F','F'),
('2','Cand furtuni in viata-mi vin','C','C'),
('3','El este Domn si domneste in ceruri','E','E'),
('4','Iata-mi naintea Ta','G','G'),
('5','Al meu Domn, parinte','A','A'),
('6','Doamne, azi eu vin','G','G'),
('7','O lume intreaga sta in nepasare','D','D'),
('8','Suntem prin Domnul Isus','G','G'),
('9','Ochii Domnului plini de dragoste privesc','G','G'),
('10','In casa ta, doamne, aud cuvantul sfant','G','G'),
('11','Ne despartin, la drum pornim','F','F'),
('12','Eram jos in pacat','A','A'),
('13','Viata tinereasca','G','G'),
('14','Ne-a aratat raul vietii','A','A'),
('15','Nu este munte prea-nalt','A','A'),
('16','O, de-ai vrea sa vii la el','G','G'),
('17','Pe Isus L-am primit cand m-a chemat','F','F'),
('18','Pentru tine-un pacatos','Am','a'),
('19','Pleaca-ti genunchii, Isus e-aici','A','A'),
('20','Domn peste pamant','C','C'),
('20b','Lumina Ta.','C','C'),
('21','Domnul este lumina in nopatea cea grea','D','D'),
('22','Duhul Domnului este putere','E','E'),
('23','Primeste lauda si inchinarea','C','C'),
('24','Cant Doamne-n Templul Tau','C','C'),
('25','In lumina iubirii tale','G','G(sau A)'),
('26','Tu esti domn al creatiei, al lumii-ntregi','C','C'),
('27','Cu nerabdare astept ziua','F','F'),
('27b','Lasati duhul sfant sa lucreze','E','E'),
('28','Osana, Osana, Osana-n inaltime','F','F'),
('29','Inaintea Mielului curand vom sta','F','F'),
('30','Maret esti Dumnezeu','C','C'),
('31','Voi slavi pe mielul gloriei','D','D'),
('32','Ai un loc la cruce si tu','E','E'),
('33','Aud ciocanele cum bat','F','F'),
('34','Ai fost rastignit','F','F'),
('35','El e Domn','F','F'),
('36','A treia zi, din morti Isus a inviat','E','E'),
('37','E viu, e viu, e viu in orice timp','E','E'),
('38','Hristos din morti a inviat in slava Lui','A','A'),
('39','A inviat Isus Cristos','E','E'),
('40','Aleluia, Aleluia, Aleluia el e domn','C','C'),
('41','Cerul declara gloria celui inviat','A','A'),
('42','El ne-a iubit venind in lume','G','G'),
('43','Nici un prieten nu e bun ca Isus','D','D'),
('44','Din gura-n gura salutul Cristos a-nviat','C','C'),
('45','Chiar in drum spre Ierihon','A','A'),
('46','Dumnezeu este iubirea','Eb','Eb'),
('47','Isus iubit, noi te adoram','F','F'),
('48','Pe marea vietii o barca pluteste usor','C','C'),
('49','Numai prin gratia lui isus','C','C'),
('50','Spre slava Sa, cantari de lauda','C','C'),
('51','Cand aud in departare','A','A'),
('52','Iti vom canta, Doamne, Tie','E','E'),
('53','Jos la picioarele-Ti stau','A','A'),
('54','Pot sa se mute muntii','F','F'),
('55','As vrea sa Te cunosc','F','F'),
('56','Caci iata ca El a intocmit muntii','A','A'),
('57','Cat de bine ma simt cu alesii Domnului','F','F'),
('58','E-o minune cand soarele-apune','C','C'),
('59','Cuvinte nu gasesc, Isuse bun','E','E'),
('60','Doar langa Tine-mi aflu pacea','G','G'),
('61','Cum doreste un cerb','C','C'),
('62','Eu ma-ncred doar in Domnul','F','F'),
('63','In aceasta ora, Doamne, Te rugam','Cm','c'),
('64','Inima-mi canta de bucurie','Bb','Bb'),
('65','Nu va fi o veste mai frumoasa','G','G'),
('66','O, fa-ma un instrument','E','E'),
('67','Omule, ce stai acum','E','E'),
('68','Sa ''nalt jerfta Ta, isuse','Fm','f'),
('69','Sa-ngenuchezi, Hrist te va primi','G','G'),
('70','Sa venim naintea Lui','F','F'),
('71','Si daca incercarea loveste fara mila','Eb','Eb'),
('72','Singur eram in aceasta lume','C','C'),
('73','Sunt aici, la dispozitia Ta','F','F'),
('74','Suntem stransi in jurul Lui','E','E'),
('75','Te-am gasit pe muntii inalti','D','D'),
('76','Vei secera candva','E','E'),
('77','Spre tine, doamne, indrept azi glasul',null,''),
('78','Tu-mi esti lumina','D','D'),
('79','O inima curata, doamne','E','E'),
('80','Stau si privesc ochii adanci','Em','e'),
('81','Renuntand la gandurile mele','G','G'),
('82','Cerul e orasul de dincolo de nori','G','G'),
('83','Astazi vin la tine domnul meu','F','F'),
('84','Doamne, te onoram','E','E'),
('85','Cand privesc bolta-nstelata','B','B'),
('86','El e-aici, aleluia','Db','Db'),
('87','Atatia oameni n-au nici-o tinta','E','E'),
('88','Doamne, Tu esti Dumnezeu','F','F'),
('89','Spala-mi, Doamne, gandul','G','G'),
('90','Aleluia, onoare si cinste','G','G'),
('91','Aleluia, onoare si cinste','G','G'),
('92','Astazi ma-nchin Domnului','F','F'),
('93','Eu nu stiu cat timp','F','F'),
('94','Inima mea vrea sa-ti cante','A','A'),
('95','Nimeni, doar tu, doamne','G','G'),
('96','Caci pentru mine a trai este Hristos','F','F'),
('97','Cand drumul vietii e greu','A','A'),
('98','Drag prieten',null,''),
('99','Cu gandul spre ceruri',null,''),
('100','Inima mea tanjeste dupa curtile Tale','C','C'),
('101','Asa de-aproape de Tin',null,''),
('102','Stam in a ta prezenta',null,''),
('103','Voi binecuvanta pe Domnul in orice vreme','C','C'),
('104','Se cuvine sa te laud','C','C'),
('105','La tine, Doamne','E','E'),
('106','Arunc grijile asupra Ta','D','D'),
('107','Ma aflam pe-a mea carare','F','F'),
('108','Am fost mantuiti','F','F'),
('109','Speranta mea e Isus','E','E'),
('110','Veniti, cantati lui Dumnezeu','C','C'),
('111','Am gasit in Domnul fericirea','C','C'),
('112','Din Betleem la Calvar','F','F'),
('113','Tu-mi esti refugiu','G','G'),
('114','Ce bucurie sa ma stiu copilul tau','G','G'),
('115','Fiindca atat de mult',null,''),
('116','Ne-ntoarcem azi sa-ti multumim','F','F'),
('117','Drumul vietii am gasit','F','F'),
('118','Ai platit un pret','F','F'),
('119','Iata, apar stele','F','F'),
('120','La tine venim','A','A'),
('121','Vocea lui se aude','E','E'),
('122','Cand vrei sa vii',null,''),
('123','Sus la Calvar',null,''),
('124','maretul har','F','F'),
('125','Am gasit o dulce mangaiere','Eb','Eb'),
('126','Am gresit de atatea ori','E','E'),
('127','Slavesc pe creatorul','F','F'),
('128','Haideti, crestini, azi cu toti','C','C'),
('129','Spala-mi, doamne, gandul','G','G'),
('130','Cand Isus Hristos m-a mantuit','G','G'),
('131','Doamne-n tine ma incred','A','A'),
('132','Imnuri de slava spre cer se inalta','G','G'),
('133','O cantare de marire','C','C'),
('134','Vesnic slaca tie','Eb','Eb'),
('135','Cu totii sa cantam','G','G'),
('136','Da, chiar in curand','E','E'),
('137','Eu pe domnul iubesc','F','F'),
('138','Inima mea','E','E'),
('139','Cu Isus in lumea asta','F','F'),
('140','O, Isus, miel divin','G','G'),
('141','Ca stropii de roua','F','F'),
('142','Dupa ploaie si furtuna','E','E'),
('143','Cand eram pandit de-o ispita','D','D'),
('144','Domane, fa al meu cuvant','D','D'),
('145','Doar o coliba','C','C'),
('146','Sfarsitul veacului traim','G','G'),
('147','Cerul e-un loc minunat','G','G'),
('148','Sunt strajerul care striga','C','C'),
('149','Impreuna din nou','F','F'),
('150','Pe pamant vom gasi','G','G'),
('151','Viata far de tine','C','C'),
('152','O lume pagana',null,''),
('153','Vreau langa Dumnezeu','E','E'),
('154','Strang cuvantul tau','C','C'),
('155','Tie-ti dam slava si onoare','C','C'),
('156','Schimba-mi inima','C','C'),
('157','Deschide-mi ochii','E','E'),
('158','Tu stai mai sus de ceruri','G','G'),
('159','De tine ocrotiti','G','G'),
('160','Ganduri negre ma pandesc','G','G'),
('161','Doamne, vreau sa-ti multumesc','Eb','Eb'),
('162','De nu poti sa platesti',null,''),
('163','Cand zorii se-arata','D','D'),
('164','Suntem aici, in prezenta ta',null,''),
('165','Dumnezeu e dragoste','C','C'),
('166','Spala-ma in raul dragostei',null,''),
('167','Doamne, esti mai scump ca argintul','F','F'),
('168','Tu esti pastorul meu, al sufletului meu','E','E'),
('169','Isus, izvorul vietii noastre','D','D'),
('170','In numele celui ce ne-a iubit','D','D'),
('171','Doua maini, astazi, Doamne','G','G'),
('172','Hristos, in Cana Galileii','C','C'),
('173','In seara-aceasta, inaintea voastra','E','E'),
('174','Iata ziua ce-ati cerut-o','E','E'),
('175','Azi, te rog, Isuse din slava','E','E'),
('176','Bine-ati venit azi la altar','A','A'),
('177','Vino, Isus, la nunta','C','C'),
('178','O, Isus, te imploram',null,''),
('179','Dragoste, dragoste','A','A'),
('180','La nunta voastra','F','F'),
('181','Azi e o zi de sarbatoare',null,''),
('182','Ce dar sa-i dau regelui','C','C'),
('183','O, ce veste minunata','F','F'),
('184','O, noapte preasfintita','Bb','Bb'),
('185','E nopate si toata lumea doarme','C','C'),
('186','O, ce veste imbucuratoare','D','D'),
('187','Cantati toti de bucurie','C','C'),
('188','Veniti credinciosi azi plini de bucurie','F','F'),
('189','Cu mult in urma-n Betleem','Bb','Bb'),
('190','In seara-aceasta totu-i minunat','E','E'),
('191','Intr-un staul mic','F','F'),
('192','In mine-a rasarit','Eb','Eb'),
('193','E noapte in Iudeea','E','E'),
('194','Noapte de Craciun','D','D'),
('195','Hristos ni s-a nascut','D','D'),
('196','Trei pastori au auzit','A','A'),
('197','Auzi corul ingeresc','G','G'),
('198','De-a lungul vietii tale','E','E'),
('199','Glorie, S-a nascut Mesia','F','F'),
('200','Ingerii canta-n cor','F','F'),
('201','Iata vestea ce-a venit din cer',null,''),
('202','Dulce rasuna prin noapte','C','C'),
('203','Veniti la Betleem sa-l vedeti pe el','F','F'),
('204','Domnul m-a gasit','A','A'),
('205','Pe-oceanul infinit','F','F'),
('206','Nimeni in afara de tine','Bb','Bb'),
('207','Zi de zi, clipita de clipita','D','D'),
('208','Eu am pornit fericit pe-o carare','G','G'),
('209','Raspandeste lumina','D','D'),
('210','An nou de indurare',null,''),
('211','A lui Hristos venire','G','G'),
('212','Dragoste divina, sfanta','G','G'),
('213','Isus, viata noastra',null,''),
('214','Pe sfanta vietii carare','D','D'),
('215','Pierdut in lume',null,''),
('216','Dupa cum este scris',null,''),
('217','Am venit aici cu toti',null,''),
('218','Ce dulce este mesajul',null,''),
('219','Hai sa laudam pe Domnul Sfant',null,''),
('220','M-am hotarat sa-l urmez pe Isus','C','C'),
('221','Toate darurile de-as avea',null,''),
('222','De traiesti cu Domnul tau mereu',null,''),
('223','Daca vei vrea sa primesti',null,''),
('224','Cand frigul patrunde in suflet','A','A'),
('225','Cu-ndurare el m-a ridicat','D','D'),
('226','Asculta glasul ce te cheama',null,''),
('227','Cat de bogat si minunat',null,''),
('228','Dincolo de cer','Db','Db'),
('229','Binecuvantari ma inconjoara','C','C'),
('230','Cand incercarile prea grele ni se par',null,''),
('231','Azi Domnul este pastorul meu','Em','e'),
('232','Cand in inima-ti rasare o lumina','E','E'),
('233','Canta ingerii voios','G','G'),
('234','In Betleem e noapte linistita',null,''),
('235','Vestea buna ingeri au adus','G','G'),
('236','Cel nascut in Betleem',null,''),
('237','Multumesc de tot ce-mi dai sa vad',null,''),
('238','Lui Isus astazi ii cant','F','F'),
('239','Sunt zilele din urma',null,''),
('240','Sunt in fiecare zi cu Isus',null,''),
('241','Tinerii lui Isus',null,''),
('242','Toti ar trebui sa stim','E','E'),
('243','Fiti voiosi, fiti voiosi totdeauna',null,''),
('244','Zi de zi, clipita de clipita','D','D'),
('245','Inteleptii lumii ma inconjoara','E','E'),
('246','Ce mare si bun','C','C'),
('247','Drumtul tau cand iti este singur',null,''),
('248','Nu la intamplare sunt','G','G'),
('249','Cant Domnului ca mi-a facut bine','G','G'),
('250','Mai sus de oameni','A','A'),
('251','Traim vremi de har','G','G'),
('252','Tot ce-aveam mai bun','D','D'),
('253','Peste-ntreg pamant','C','C'),
('254','Stau din nou, gandidu-ma','D','D'),
('255','Isus e mangaierea mea','E','E'),
('256','Ascultam Doamne, lauda mea','B','B'),
('257','M-a aflat al meu Pastor','C','C'),
('258','Tine-ma in mana ta','C','C'),
('259','Muzica-ncetat','E','E (E   B/D#   f#)'),
('260','Isus, vreau sa merg',null,''),
('261','Viata si miscarea si suflarea sunt in tine','G','G'),
('262','Iubirea lui e mult prea mare','D','D'),
('263','Nu stiu de ce sunt ispite-adesea',null,''),
('264','Lumina lumii, prezenta divina',null,''),
('265','In fata tronului de sus','D','D'),
('266','O, tata sfant, noi te iubim','Bb','Bb'),
('267','Iti multumesc din inima','F','F'),
('268','Doamne, bunatatea ta','F','F'),
('269','L-am vazut pe Isus pe Golgota urcand','G','G->Ab->A'),
('270','Vreau sa spuna cel ce-i slab','C','C'),
('271','Eu nu te vad, dar stiu ca esti aici',null,''),
('272','Ne plecam in umilinta',null,''),
('273','Simt prezenta slavei Tale','D','D'),
('274','Domnul ne-a creat dupa chipul sau','F','F'),
('275','Sunt iertat, caci ai fost parasit',null,''),
('276','Nu vreau sa fiu ingrijorat','G','G'),
('277','Cel ce linisteste marea',null,''),
('278','Cand eram cazut, tu m-ai ridicat','Bb','Bb'),
('279','Voi pierduti cu sarcini grele','E','E'),
('280','Ce mare esti tu, ce mare e mila ta','C','C'),
('281','Astazi cant voios','C','C'),
('282','Zi de zi, din fantana mantuirii','F','F'),
('283','Domnu-i bun, orisicand','D','D'),
('284','Aleluia, aleluia,  domnul nostru',null,''),
('285','Astazi nu mai sunt minuni','G','G'),
('286','Cand eu stau si ma gandesc',null,''),
('287','Canta, sriga, bate din palme','E','E'),
('288','Cel ce linisteste marea','C','C ( sau D )'),
('289','Cel ce sta sub ocrotirea','Bb','Bb'),
('290','Cred in Dumnezeu ca tata','E','E'),
('291','Curgi ca un rau de slava','D','D'),
('292','Din el, prin el si pentru el','Em','e'),
('293','Doamne, da-ne-ntelepciune','E','E'),
('294','Zorile rasar','Am','a'),
('295','Eu nu te vad','C','C'),
('296','Fara muzica',null,''),
('297','Fii a mea lumina','D','D'),
('298','Isus, ce bucurie',null,''),
('299','Iubire-adanca-a tatalui','E','E'),
('300','Langa tine vreau','G','G'),
('301','Lumina lumii','D','D'),
('302','Marturisim acum ca suntem slabi','Bb','Bb   (ref:  c  Bb/D     Eb)'),
('303','Medley',null,''),
('304','Ne plecam in umilinta',null,''),
('305','Nu-i pe lume nici-o cale',null,''),
('306','Numai un pas spre Domnul','G','G'),
('307','O schimbare','D','D'),
('308','O, miel ceresc','C','C'),
('309','Preaiubitul meu e Isus','G','G'),
('310','Sangele tau, vorbeste mai profund','A','A'),
('311','Tata, noi vrem','F','F'),
('312','Un tron inalt e-n cer','E','E'),
('313','Unii spun ca nu poti fi gasit','A','A'),
('314','Medley2',null,''),
('315','Cinste, onoare, glorie, splendoare','C','C'),
('316','Cum pot rasplati eu','E','E'),
('317','Rege-al regilor, esti tu','Bb','Bb'),
('318','Imi va ramane-n memorie-o zi','F','F'),
('319','Zi de zi eu vreau',null,''),
('320','Ce mare esti','A','A'),
('321','Fara el nimic nu poti face',null,''),
('322','Iata-ma smerit de maiestatea ta','A','A'),
('323','Pacatele imbatranesc','D','D'),
('324','Esti vrednic, Doamne','F','F'),
('325','Speranta mea e in Isus','D','D'),
('326','E-a treia zi de cand muri','E','E'),
('327','ZIdeste in mine','F','F'),
('328','Cu tot e am, cu tot ce sunt',null,''),
('329','Golgota','F','F'),
('330','Spune-mi te-ai gandit','Eb','Eb'),
('331','Vine o zi cand vom pleca','F','F'),
('332','Doamne numele-ti inalt','G','G'),
('333','Veniti sa ii multumim','F','F'),
('334','Spune-mi ce este viata omului','C','C'),
('335','Hai, hai e timpul de-nchinare','D','D'),
('336','Alelu et-Adonai','Am','a'),
('337','Ai deschis cerul tau','A','A'),
('338','Aleluia, aleluia','A','A'),
('339','Doamne, vreau sa ma-nchin','F','F'),
('340','Destinul tau e sa invingi','E','E'),
('341','Vrednic esti de cinste','C','C'),
('342','Cei trei magi din rasarit','Em','e'),
('343','S-a nascut in Betleem',null,''),
('344','Ingerul din cer vestise','E','E'),
('345','Fiindca nu am smirna','D','D'),
('346','E craciun acuma iar',null,''),
('347','O noapte sfanta binecuvantata','A','A'),
('348','Zideste in mine','F','F'),
('349','Doamne azi venim cu pruncul','F','F'),
('350','Tu din vanturi faci solii.','C','C'),
('351','Binecuvanteaza, suflete','D','D'),
('352','Doamne daca vrei','Bm','b'),
('353','Am ales pe Domnul Isus','G','G'),
('354','Aceasta e','G','G'),
('355','Inainte sa-mi vorbesti','D','D'),
('356','Dumnezeu e taria mea','Em','e'),
('357','In tine este viata mea','F','F'),
('358','El shadai','F','F'),
('359','Eu sunt un om, sunt doar un om','C','C'),
('360','Tu ma ridici','C','C'),
('361','Uimit de-atata bogatie','F','F'),
('362','Am venit dni departare','G','G'),
('363','Doamne tu esti bucuria mea','F','F'),
('364','',null,''),
('365','Hai spune-mi cine a biruit moartea','Fm','f'),
('366','Lauda cinste onoare','G','G'),
('367','Eu stiu ca m-ai mantuit','F','F'),
('368','Pentru soare si ploaie','F','F'),
('369','Iti multumesc pentru speranta','G','G'),
('370','Duhul tau mi-a fost un stalp de foc in noapte','Dm','d'),
('371','Tu esti sfant','E','E'),
('372','E o zi mareata','Eb','Eb'),
('373','Azi s-a nascut',null,''),
('374','O prunc divin',null,''),
('375','Laudat sa fii Isuse',null,''),
('376','Veniti sa ne-nchinam',null,''),
('377','O stea pe cer, lumineaz-acum','C','C'),
('378','Rama linistit','D','D'),
('379','Ierusalim','C','C'),
('380','Scumpa vesnicia','F','F'),
('381','Leaga-ti inima de cer','Eb','Eb'),
('382','Voi inalta numele Tau','E','E'),
('383','Al meu domn puternic (hillsong)','F','F'),
('384','El e sfant','Am','a'),
('385','Nimeni nu e ca el, mare e Dumnezeu','E','E'),
('386','Zi de zi esti cu mine','A','A'),
('387','Domnul sta in fruntea oastei lui','Am','a'),
('388','In orice suflet e-un tainic dor','A','A'),
('389','Cand se naste un copil','D','D'),
('390','Fii binecuvantat','A','A'),
('391','Cum sa nu-ti cant eu laude-n veci','E','E'),
('392','Mare esti, rege in veci de veci','A','A 66'),
('393','Eu intru in sfanta-ti prezenta','Em','e'),
('394','Noi cantam','Eb','Eb'),
('395','Rege si rob smerit','C','C'),
('396','Cand spre tine imi intorc privirea','C','C'),
('397','Doamne Tu ce misti chiar muntii','G','G'),
('398','Un cantec de lauda.','E','E'),
('399','Toate le-ai creat','E','E'),
('400','Sunt un pribeag fara de tara','Cm','c'),
('401','Orice pas Isus mi-l conduce',null,''),
('402','Nu sunt in ceruri lacrimi','F','F'),
('403','Tu esti izvorul vietii mele',null,''),
('404','Cetate tare','E','E'),
('405','Apa-i schimbat-o in vin','E','E'),
('406','Ne-ai ales ca sa traim','A','A'),
('407','Isus s-a nascut','G','G'),
('408','10000 motive','D','D'),
('409','Eternul Dumnezeu',null,''),
('410','Eu de tine am nevoie','D','D'),
('411','In el in Domnul meu','F','F->G->A'),
('412','Inviat','F','F'),
('413','Ai biruit mormantul','A','A'),
('414','In inima ta',null,''),
('415','Traiesc pentru tine',null,''),
('416','Dragostea','F','F'),
('417','Har din cer si binecuvantare','E','E'),
('418','Pentru cruce-ti multumesc','A','A'),
('419','El va ramane credincios',null,''),
('420','Vesnic aleluia',null,''),
('421','Isus o ce nume frumos','D','D'),
('422','Mare domn avem','G','G'),
('423','Crezul','F','F'),
('424','Hai deschide inima ta',null,''),
('425','Lipeste-mi Doamne, sufletul de tine','C','C'),
('426','Rabuni, tu din morti ai inviat','E','E'),
('427','Fratilor credinta noastra s-o pazim','Cm','c'),
('428','Ce dar maret e Isus Salvatorul','D','D'),
('429','Credinta mea eu o zidesc','D','D'),
('430','O carte cu sapte peceti','Gm','g'),
('431','Isus cu slava imbracat','C','C'),
('432','Eu am un creator','C','C'),
('433','Fericirea e in inimi',null,''),
('434','Nu va injugati la un jug nepotrivit','Dm','d'),
('435','Noi suntem una-n Isus',null,''),
('436','Vreau sa stiu ce e sfant',null,''),
('437','Pe Isus cu cat il cunosc',null,''),
('438','Un singur Dumnezeu',null,''),
('439','Cand ma aflu-n prezenta ta','Eb','Eb'),
('440','Numele tau e minunat','Dm','d'),
('441','Glorie, vreau sa ii cant glorie',null,''),
('442','Haideti sa cantam cu veselie Domnului','A','A'),
('443','Cu Isus vreau sa-mi continui calea','D','D'),
('444','Venim in a ta prezenta','D','D'),
('445','Eu cand osana, cant aleluia','G','G'),
('446','Om al durerii, miel divin','C','C'),
('447','Am venit cu bucurie',null,''),
('448','Voi rezidi altarul','C','C'),
('449','Spala-ma in raul dragostei','Dm','d'),
('450','Acum paraseste',null,''),
('451','Drumul slavei trece doar pe la cruce','Cm','c'),
('452','Aceasta-mi e dorinta',null,''),
('453','Suflete scoala din amorteala','Dm','d'),
('454','Cand zaceam sub grea povara',null,''),
('455','Pazeste-ti piciorul',null,''),
('456','Voi numai de viata asta',null,''),
('457','Pentru noi e taina mare','Bb','Bb'),
('458','Cel minunat, salVatorul','C','C'),
('459','Ne vom aduce mereu aminte','Db','Db   (modulatii: Db   D  E   F )'),
('460','Tu ma cercetezi de-aproape','G','G'),
('461','Toate lucrurile Doamne','Gm','g'),
('462','Tot mai sfant','E','E'),
('463','Atat am cautat rostul vietii','C','C'),
('464','Eu nu pot vorbi iscusit despre Tine','Cm','c (c   f   c   f   Bb9   Eb    G    f    c   C    f    G      Ab   Bb      c)'),
('465','Nu stiu cat mai am harul',null,''),
('466','Rasuna astazi in toate tarile',null,''),
('467','Noi ridicam catre cer','E','E'),
('470','El n-a promis doar cerul senin','F','F'),
('474','pe genunchi',null,'D/E'),
('491','Isus îți dau viața mea','A','A'),
('499','Lui Isus toată slava','C','C'),
('500','Mărețul har - lanțul s-a rupt','D','D'),
('501','Valoarea mea nu stă-n averi','D','D'),
('502','Cântăm Aleluia',null,'D/E')
on conflict(reference_number) do update set title=excluded.title,musical_key=excluded.musical_key,original_notation=excluded.original_notation;
create or replace function public.key_title_normalized_v46(p_title text)
returns text language sql stable security invoker set search_path=public as $$
 select trim(regexp_replace(lower(public.unaccent(regexp_replace(coalesce(p_title,''),'^\s*[0-9]+[a-z]?[.) -]+','','i'))),'[^a-z0-9]+',' ','g'));
$$;
create table if not exists public.youth_key_applied_v46 (
 song_id uuid primary key references public.songs(id) on delete cascade,
 previous_key text, applied_key text not null, applied_at timestamptz not null default now()
);
alter table public.youth_key_applied_v46 enable row level security;
drop policy if exists youth_key_applied_read on public.youth_key_applied_v46;
create policy youth_key_applied_read on public.youth_key_applied_v46 for select to authenticated using (exists(select 1 from public.profiles where id=auth.uid() and is_active));
grant select on public.youth_key_applied_v46 to authenticated;

-- No fuzzy matching and no number-only assignment. Prefer a matching number AND title.
create or replace function public.get_youth_key_matches_v46()
returns table(reference_number text,title text,musical_key text,original_notation text,song_id uuid,match_status text)
language sql stable security invoker set search_path=public as $$
with refs as materialized (
 select r.*,public.key_title_normalized_v46(r.title) as normalized_title from public.youth_key_reference_v46 r
), scoped as materialized (
 select distinct s.id as song_id,lower(trim(coalesce(ss.song_number,''))) as song_number,
 public.key_title_normalized_v46(s.title) as normalized_title,public.key_title_normalized_v46(ss.source_title) as source_title
 from public.song_sources ss join public.song_collections sc on sc.id=ss.collection_id join public.songs s on s.id=ss.song_id
 where s.is_active and sc.is_active
 and (upper(coalesce(sc.short_code,''))='TINERI' or public.key_title_normalized_v46(sc.name) in ('tineri','cantari tineri','cantarile tinerilor','cantari pentru tineri'))
), candidates as materialized (
 select distinct r.reference_number,r.musical_key,s.song_id,s.song_number=lower(r.reference_number) as same_number
 from refs r join scoped s on (r.normalized_title=s.normalized_title or r.normalized_title=s.source_title)
 where length(r.normalized_title)>2
), preferred as (
 select c.* from candidates c where c.same_number or not exists(select 1 from candidates p where p.reference_number=c.reference_number and p.same_number)
), unique_matches as (
 select reference_number,(array_agg(distinct song_id))[1] as song_id,count(distinct song_id) as n from preferred group by reference_number
), conflicts as (
 select u.song_id from unique_matches u join public.youth_key_reference_v46 r using(reference_number)
 where u.n=1 and r.musical_key is not null group by u.song_id having count(distinct r.musical_key)>1
)
select r.reference_number,r.title,r.musical_key,r.original_notation,
 case when u.n=1 and c.song_id is null then u.song_id else null end,
 case when r.musical_key is null then case when r.original_notation='' then 'no_key' else 'review_notation' end
 when u.n is null then 'no_match' when u.n>1 then 'ambiguous' when c.song_id is not null then 'conflicting_keys'
 when a.applied_key=r.musical_key and s.default_key=r.musical_key then 'applied'
 when a.song_id is not null and s.default_key is distinct from a.applied_key then 'edited_after_import'
 else 'matched' end
from public.youth_key_reference_v46 r left join unique_matches u using(reference_number)
left join conflicts c on c.song_id=u.song_id left join public.youth_key_applied_v46 a on a.song_id=u.song_id
left join public.songs s on s.id=u.song_id
order by nullif(regexp_replace(r.reference_number,'[^0-9]','','g'),'')::integer,r.reference_number;
$$;
revoke all on function public.get_youth_key_matches_v46() from public,anon;
grant execute on function public.get_youth_key_matches_v46() to authenticated;

-- Audited, repeatable assignment. A later manual edit is never overwritten on rerun.
with matches as materialized (select distinct song_id,musical_key from public.get_youth_key_matches_v46() where match_status='matched'),
logged as (
 insert into public.youth_key_applied_v46(song_id,previous_key,applied_key)
 select m.song_id,s.default_key,m.musical_key from matches m join public.songs s on s.id=m.song_id
 on conflict(song_id) do nothing returning song_id,applied_key
)
update public.songs s set default_key=l.applied_key from logged l where s.id=l.song_id;
notify pgrst,'reload schema';
commit;

begin;
-- Assign numbers only to newly attached songs or explicitly cleared numbers.
create or replace function public.assign_song_source_number_v47() returns trigger language plpgsql security definer set search_path=public as $$
declare v_next numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.collection_id::text,47));
  if nullif(trim(new.song_number),'') is null then
    select coalesce(max(substring(song_number from '^[0-9]+')::numeric),0)+1 into v_next
    from public.song_sources where collection_id=new.collection_id and id is distinct from new.id;
    new.song_number:=v_next::text;
  end if;
  return new;
end $$;
drop trigger if exists song_sources_number_v47 on public.song_sources;
create trigger song_sources_number_v47 before insert or update of song_number,collection_id on public.song_sources for each row execute function public.assign_song_source_number_v47();
create or replace function public.ensure_manual_collection_v47() returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('songapp-manual-collection',47));
 select id into v_id from public.song_collections where short_code='MANUAL' and is_active limit 1;
 if v_id is null then
   insert into public.song_collections(name,short_code,source_type) values('Adăugate manual','MANUAL','manual')
   on conflict(short_code) do update set is_active=true returning id into v_id;
 end if;
 return v_id;
end $$;
revoke all on function public.ensure_manual_collection_v47() from public,anon;
grant execute on function public.ensure_manual_collection_v47() to authenticated;

-- Calendar includes scheduled meetings; popularity remains past-only.
create or replace function public.get_song_history_v46(p_song_id uuid,p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security invoker set search_path=public as $$
with uses as materialized (
 select distinct mi.song_id,m.id as meeting_id,m.title as meeting_title,m.meeting_date,m.meeting_type,(m.meeting_date>now()) as is_future
 from public.meeting_items mi join public.meetings m on m.id=mi.meeting_id
 where mi.song_id=p_song_id and not mi.is_backup and not m.is_template
), rows as (select * from uses order by meeting_date desc,meeting_id limit least(greatest(coalesce(p_page_size,30),1),100) offset (greatest(coalesce(p_page,1),1)::bigint-1)*least(greatest(coalesce(p_page_size,30),1),100))
select jsonb_build_object('total',(select count(*) from uses),'performed_total',(select count(*) from uses where not is_future),
 'upcoming_total',(select count(*) from uses where is_future),'last_used_at',(select max(meeting_date) from uses where not is_future),
 'entries',coalesce((select jsonb_agg(to_jsonb(rows) order by meeting_date desc,meeting_id) from rows),'[]'::jsonb));
$$;

-- Keep the complete previous versions when a merge is explicitly confirmed.
create table if not exists public.song_merge_history_v47 (
 id uuid primary key default gen_random_uuid(),primary_song_id uuid,merged_by uuid,merged_at timestamptz not null default now(),archived_songs jsonb not null
);
alter table public.song_merge_history_v47 enable row level security;
drop policy if exists merge_history_editor_read on public.song_merge_history_v47;
create policy merge_history_editor_read on public.song_merge_history_v47 for select to authenticated using(public.can_edit_content());
grant select on public.song_merge_history_v47 to authenticated;
revoke insert,update,delete on public.song_merge_history_v47 from public,anon,authenticated;
create or replace function public.merge_duplicate_songs(p_primary_song_id uuid,p_duplicate_song_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_duplicates uuid[];v_all uuid[];v_count integer;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
 if p_primary_song_id is null then raise exception 'Alege cântarea principală.'; end if;
 select array_agg(distinct id) into v_duplicates from unnest(p_duplicate_song_ids) id where id is not null and id<>p_primary_song_id;
 if coalesce(cardinality(v_duplicates),0) not between 1 and 1000 then raise exception 'Alege între 1 și 1000 de duplicate.'; end if;
 v_all:=array_append(v_duplicates,p_primary_song_id);
 perform id from public.songs where id=any(v_all) order by id for update;
 if (select count(*) from public.songs where id=any(v_all))<>cardinality(v_all) then raise exception 'Una dintre cântări nu mai există. Reîncarcă lista.'; end if;
 if not exists(select 1 from public.songs where id=p_primary_song_id and is_active) then raise exception 'Cântarea principală nu este activă.'; end if;
 insert into public.song_merge_history_v47(primary_song_id,merged_by,archived_songs)
 select p_primary_song_id,auth.uid(),jsonb_agg(jsonb_build_object('song',to_jsonb(s),'sections',(select jsonb_agg(to_jsonb(x) order by x.position) from public.song_sections x where x.song_id=s.id),
 'sources',(select jsonb_agg(to_jsonb(x)) from public.song_sources x where x.song_id=s.id),'key_audit',(select to_jsonb(x) from public.youth_key_applied_v46 x where x.song_id=s.id)))
 from public.songs s where s.id=any(v_duplicates);
 update public.meeting_items set song_id=p_primary_song_id where song_id=any(v_duplicates);
 update public.public_meeting_contributions set song_id=p_primary_song_id where song_id=any(v_duplicates);
 update public.song_files set song_id=p_primary_song_id where song_id=any(v_duplicates);
 update public.external_song_refs set song_id=p_primary_song_id where song_id=any(v_duplicates);
 update public.song_link_imports set song_id=p_primary_song_id where song_id=any(v_duplicates);
 -- Move the original source rows: INSERT ON CONFLICT followed by DELETE lost their own conflicting rows.
 update public.song_sources set song_id=p_primary_song_id where song_id=any(v_duplicates);
 insert into public.song_categories(song_id,category_id) select distinct p_primary_song_id,category_id from public.song_categories where song_id=any(v_duplicates) on conflict do nothing;
 insert into public.song_bible_references(song_id,bible_reference_id,theme,reason,confidence,created_by)
 select distinct p_primary_song_id,bible_reference_id,theme,reason,confidence,created_by from public.song_bible_references where song_id=any(v_duplicates) on conflict do nothing;
 delete from public.songs where id=any(v_duplicates);
 get diagnostics v_count=row_count;
 return jsonb_build_object('merged',v_count,'primarySongId',p_primary_song_id);
end $$;
revoke all on function public.merge_duplicate_songs(uuid,uuid[]) from public,anon;
grant execute on function public.merge_duplicate_songs(uuid,uuid[]) to authenticated;
create or replace function public.merge_duplicate_song_groups_v47(p_groups jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_group jsonb;v_primary uuid;v_duplicates uuid[];v_used uuid[]:='{}';v_ids uuid[];v_result jsonb;v_count integer:=0;
begin
 if not public.can_edit_content() then raise exception 'Acces interzis.' using errcode='42501'; end if;
 if jsonb_typeof(p_groups) is distinct from 'array' or jsonb_array_length(p_groups) not between 1 and 200 then raise exception 'Alege între 1 și 200 de grupuri afișate.'; end if;
 -- Validate every plan before any write; a song cannot participate in two groups.
 for v_group in select * from jsonb_array_elements(p_groups) loop
   v_primary:=(v_group->>'primary')::uuid;
   select array_agg(distinct value::uuid) into v_duplicates from jsonb_array_elements_text(v_group->'duplicates') where value::uuid<>v_primary;
   if coalesce(cardinality(v_duplicates),0)=0 then raise exception 'Un grup nu are duplicate selectate.'; end if;
   v_ids:=array_append(v_duplicates,v_primary);
   if v_used&&v_ids then raise exception 'O cântare apare în mai multe grupuri.'; end if;
   if (select count(distinct public.normalize_song_title_for_duplicates(title)) from public.songs where id=any(v_ids))<>1 then raise exception 'Grupul conține titluri diferite. Verifică selecția.'; end if;
   v_used:=v_used||v_ids;
 end loop;
 perform id from public.songs where id=any(v_used) order by id for update;
 for v_group in select * from jsonb_array_elements(p_groups) loop
   v_primary:=(v_group->>'primary')::uuid;
   select array_agg(value::uuid) into v_duplicates from jsonb_array_elements_text(v_group->'duplicates');
   v_result:=public.merge_duplicate_songs(v_primary,v_duplicates);v_count:=v_count+(v_result->>'merged')::integer;
 end loop;
 return jsonb_build_object('merged',v_count,'groups',jsonb_array_length(p_groups));
end $$;
revoke all on function public.merge_duplicate_song_groups_v47(jsonb) from public,anon;
grant execute on function public.merge_duplicate_song_groups_v47(jsonb) to authenticated;

create or replace function public.import_reviewed_song_link(
  p_source_key text,p_url text,p_title text,p_lyrics text,p_sections jsonb,
  p_collection_ids uuid[],p_existing_song_id uuid default null,p_notes text default null,
  p_structure text default null,p_song_number text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_song uuid; v_mapped uuid; v_collection uuid; v_file uuid; v_new boolean:=false; v_collections uuid[]; v_linked integer:=0;
begin
  if not public.can_edit_content() then raise exception 'Nu ai permisiunea pentru import.' using errcode='42501'; end if;
  if p_url is null or length(p_url)>2000 or p_url !~ '^https?://[^/[:space:]@]+(/|$)' or p_source_key is null then raise exception 'Link invalid.'; end if;
  if p_source_key like 'resursecrestine:%' then
    if p_url !~ '^https://www\.resursecrestine\.ro/cantece/[0-9]+/[^/?#]+$' or p_source_key <> 'resursecrestine:'||substring(p_url from '/cantece/([0-9]+)') then raise exception 'Link invalid.'; end if;
  elsif p_source_key <> 'web:'||encode(sha256(convert_to(p_url,'UTF8')),'hex') then raise exception 'Identificator de link invalid.'; end if;
  if length(trim(coalesce(p_title,''))) not between 1 and 300 or length(trim(coalesce(p_lyrics,''))) not between 20 and 100000 then raise exception 'Verifică titlul și versurile.'; end if;
  if jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections) not between 1 and 200 then raise exception 'Secțiuni invalide.'; end if;
  select array_agg(distinct c) into v_collections from unnest(p_collection_ids) c where c is not null;
  if coalesce(cardinality(v_collections),0) not between 1 and 20 then raise exception 'Alege între 1 și 20 de colecții.'; end if;
  if (select count(*) from public.song_collections where id=any(v_collections) and is_active) <> cardinality(v_collections) then raise exception 'Una dintre colecții nu mai este activă.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_source_key,43));
  select song_id into v_mapped from public.song_link_imports where source_key=p_source_key;
  if v_mapped is not null and p_existing_song_id is not null and v_mapped<>p_existing_song_id then raise exception 'Linkul este deja asociat altei cântări. Reîncarcă preview-ul.'; end if;
  v_song:=coalesce(v_mapped,p_existing_song_id);
  if v_song is null then
    select r.song_id into v_song from public.external_song_refs r join public.songs s on s.id=r.song_id
    where s.is_active and 'resursecrestine:'||substring(r.external_url from '/cantece/([0-9]+)')=p_source_key order by r.created_at limit 1;
  end if;
  if v_song is null then
    v_song:=public.import_song_with_sections(v_collections[1],trim(p_title),nullif(trim(p_song_number),''),p_lyrics,p_sections,
      trim(p_title)||'.url','other','Import din link, verificat în preview. Sursa: '||p_url,null,null,p_structure,p_notes,null);
    v_new:=true;
    select id into v_file from public.song_files where song_id=v_song order by created_at desc limit 1;
  else
    perform id from public.songs where id=v_song for update;
    if not exists(select 1 from public.songs where id=v_song and is_active) then raise exception 'Cântarea existentă nu mai este activă.'; end if;
  end if;
  foreach v_collection in array v_collections loop
    if not exists(select 1 from public.song_sources where song_id=v_song and collection_id=v_collection) then
      insert into public.song_sources(song_id,collection_id,song_number,source_title,source_file_id)
      values(v_song,v_collection,nullif(trim(p_song_number),''),(select title from public.songs where id=v_song),v_file);
      v_linked:=v_linked+1;
    end if;
  end loop;
  insert into public.song_link_imports(source_key,source_url,song_id,imported_by) values(p_source_key,p_url,v_song,auth.uid())
  on conflict(source_key) do nothing;
  return jsonb_build_object('songId',v_song,'created',v_new,'collectionsAdded',v_linked+case when v_new then 1 else 0 end);
end $$;

create or replace function public.find_duplicate_song_candidates(p_limit integer default 50)
returns table (
  group_key text,
  title_hint text,
  song_count integer,
  songs jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with normalized as (
    select
      s.id,
      s.title,
      s.default_key,
      s.bpm,
      s.created_at,
      public.normalize_song_title_for_duplicates(s.title) as group_key,
      coalesce(string_agg(distinct c.name, ', ' order by c.name), '') as collections,
      coalesce(string_agg(distinct ss.song_number, ', ' order by ss.song_number) filter (where ss.song_number is not null and ss.song_number <> ''), '') as numbers,
      length(coalesce(s.lyrics_text, '')) as lyrics_length
    from public.songs s
    left join public.song_sources ss on ss.song_id = s.id
    left join public.song_collections c on c.id = ss.collection_id
    where s.is_active
    group by s.id
  ), grouped as (
    select
      n.group_key,
      min(n.title) as title_hint,
      count(*)::integer as song_count,
      jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'title', n.title,
          'default_key', n.default_key,
          'bpm', n.bpm,
          'created_at', n.created_at,
          'collections', n.collections,
          'numbers', n.numbers,
          'lyrics_length', n.lyrics_length
        ) order by n.lyrics_length desc, n.created_at asc
      ) as songs
    from normalized n
    where length(n.group_key) >= 4
    group by n.group_key
    having count(*) > 1
  )
  select g.group_key, g.title_hint, g.song_count, g.songs
  from grouped g
  order by g.song_count desc, g.title_hint asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;


notify pgrst,'reload schema';
commit;
