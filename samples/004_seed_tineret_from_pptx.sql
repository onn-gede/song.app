-- Seed generat automat din PPTX. Verifica manual dupa import.
-- Ruleaza dupa 001_init_schema.sql si 002_seed_core_data.sql.

-- Colectie tinta: TINERI

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Am fost născut în păcat', 'Am fost născut în păcat
Dar Isus pentru mine s-a dat,
Viaţa mea de-acum e-n mâna Sa.
Şi până îl voi vedea,
Am nevoie de lumina Sa
Căci ce-a făcut nicicând nu voi uita.

Condu-mă, Doamne, ziua,
Condu-mă, e ruga mea,
Prin toate necazurile acestei lumi.
Condu-mă, Doamne, noaptea,
Condu-mă, prin lumina Ta,
Căci numai Tu poţi conduce viaţa mea.

Dumnezeu ne iubeşte mereu,
Pentru noi a dat singurul Fiu,
Ca noi să fim salvaţi azi de păcat.
Deci vino cu inima ta,
De păcat El o va spăla
Şi de-azi vei fi şi tu-n lumina Sa

Condu-mă, Doamne, ziua,
Condu-mă, e ruga mea,
Prin toate necazurile acestei lumi.
Condu-mă, Doamne, noaptea,
Condu-mă, prin lumina Ta,
Căci numai Tu poţi conduce viaţa mea.', null, 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '001 Am fost nascut in pacat.pptx', 'pptx', 'needs_review', 'Am fost născut în păcat
Dar Isus pentru mine s-a dat,
Viaţa mea de-acum e-n mâna Sa.
Şi până îl voi vedea,
Am nevoie de lumina Sa
Căci ce-a făcut nicicând nu voi uita.

Condu-mă, Doamne, ziua,
Condu-mă, e ruga mea,
Prin toate necazurile acestei lumi.
Condu-mă, Doamne, noaptea,
Condu-mă, prin lumina Ta,
Căci numai Tu poţi conduce viaţa mea.

Dumnezeu ne iubeşte mereu,
Pentru noi a dat singurul Fiu,
Ca noi să fim salvaţi azi de păcat.
Deci vino cu inima ta,
De păcat El o va spăla
Şi de-azi vei fi şi tu-n lumina Sa

Condu-mă, Doamne, ziua,
Condu-mă, e ruga mea,
Prin toate necazurile acestei lumi.
Condu-mă, Doamne, noaptea,
Condu-mă, prin lumina Ta,
Căci numai Tu poţi conduce viaţa mea.', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '001', 'Am fost născut în păcat', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Am fost născut în păcat
Dar Isus pentru mine s-a dat,
Viaţa mea de-acum e-n mâna Sa.
Şi până îl voi vedea,
Am nevoie de lumina Sa
Căci ce-a făcut nicicând nu voi uita.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '001' and ss.source_title = 'Am fost născut în păcat'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'Condu-mă, Doamne, ziua,
Condu-mă, e ruga mea,
Prin toate necazurile acestei lumi.
Condu-mă, Doamne, noaptea,
Condu-mă, prin lumina Ta,
Căci numai Tu poţi conduce viaţa mea.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '001' and ss.source_title = 'Am fost născut în păcat'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Dumnezeu ne iubeşte mereu,
Pentru noi a dat singurul Fiu,
Ca noi să fim salvaţi azi de păcat.
Deci vino cu inima ta,
De păcat El o va spăla
Şi de-azi vei fi şi tu-n lumina Sa'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '001' and ss.source_title = 'Am fost născut în păcat'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, 'Condu-mă, Doamne, ziua,
Condu-mă, e ruga mea,
Prin toate necazurile acestei lumi.
Condu-mă, Doamne, noaptea,
Condu-mă, prin lumina Ta,
Căci numai Tu poţi conduce viaţa mea.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '001' and ss.source_title = 'Am fost născut în păcat'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Doamne, binecuvântă!', 'Doamne, binecuvântă!
Doamne, binecuvântă!
Doamne, binecuvântă
Acest micuţ copilaş!

Şi mâna Ta ocrotitoare
Să fie-asupra lui mereu,
/: Dă-i sănătate şi fericire
Şi fă-l s-ajungă copilul Tău.:/

Creşte-l clipă de clipă,
Creşte-l prin Duhul Tău Sfânt,
Poartă-l pe-a Ta aripă
Cât va trăi pe pământ.

Şi mâna Ta ocrotitoare
Să fie-asupra lui mereu,
/: Dă-i sănătate şi fericire
Şi fă-l s-ajungă copilul Tău.:/

Doamne, revarsă-Ţi mila
Peste odrasla-aceasta;
Dă binecuvântare
Şi ţine-o-n dragostea Ta.

Şi mâna Ta ocrotitoare
Să fie-asupra lui mereu,
/: Dă-i sănătate şi fericire
Şi fă-l s-ajungă copilul Tău.:/', null, 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '001b.Doamne, binecuvanta.pptx', 'pptx', 'needs_review', 'Doamne, binecuvântă!
Doamne, binecuvântă!
Doamne, binecuvântă
Acest micuţ copilaş!

Şi mâna Ta ocrotitoare
Să fie-asupra lui mereu,
/: Dă-i sănătate şi fericire
Şi fă-l s-ajungă copilul Tău.:/

Creşte-l clipă de clipă,
Creşte-l prin Duhul Tău Sfânt,
Poartă-l pe-a Ta aripă
Cât va trăi pe pământ.

Şi mâna Ta ocrotitoare
Să fie-asupra lui mereu,
/: Dă-i sănătate şi fericire
Şi fă-l s-ajungă copilul Tău.:/

Doamne, revarsă-Ţi mila
Peste odrasla-aceasta;
Dă binecuvântare
Şi ţine-o-n dragostea Ta.

Şi mâna Ta ocrotitoare
Să fie-asupra lui mereu,
/: Dă-i sănătate şi fericire
Şi fă-l s-ajungă copilul Tău.:/', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '001b', 'Doamne, binecuvântă!', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Doamne, binecuvântă!
Doamne, binecuvântă!
Doamne, binecuvântă
Acest micuţ copilaş!'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '001b' and ss.source_title = 'Doamne, binecuvântă!'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'Şi mâna Ta ocrotitoare
Să fie-asupra lui mereu,
/: Dă-i sănătate şi fericire
Şi fă-l s-ajungă copilul Tău.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '001b' and ss.source_title = 'Doamne, binecuvântă!'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Creşte-l clipă de clipă,
Creşte-l prin Duhul Tău Sfânt,
Poartă-l pe-a Ta aripă
Cât va trăi pe pământ.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '001b' and ss.source_title = 'Doamne, binecuvântă!'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, 'Şi mâna Ta ocrotitoare
Să fie-asupra lui mereu,
/: Dă-i sănătate şi fericire
Şi fă-l s-ajungă copilul Tău.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '001b' and ss.source_title = 'Doamne, binecuvântă!'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '3', 5, 'Doamne, revarsă-Ţi mila
Peste odrasla-aceasta;
Dă binecuvântare
Şi ţine-o-n dragostea Ta.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '001b' and ss.source_title = 'Doamne, binecuvântă!'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 6, 'Şi mâna Ta ocrotitoare
Să fie-asupra lui mereu,
/: Dă-i sănătate şi fericire
Şi fă-l s-ajungă copilul Tău.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '001b' and ss.source_title = 'Doamne, binecuvântă!'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Când furtuni în viaţă-mi vin', 'Când furtuni în viaţă-mi vin
Pe acest pământ străin,
Doamne bun, întinde-Ţi mâna-asupra mea!
Pe genunchi, în rugă-ţi cer
Să-mi ajuţi Tu către cer,
Doamne bun, întinde-Ţi mâna-asupra mea!

Când drumul vieţii e greu
Iar crucea îmi pare grea,
Atunci cu gândul la Calvar
Eu las povara mea.
Diavolul în orice zi
De necaz nu m-ar scuti,
Doamne bun, întinde-Ţi mâna-asupra mea!

Când duşmani în cale-mi stau
Pe Isus drept scut îl iau,
Doamne bun, întinde-Ţi mâna-asupra mea!
Doamne, Ţie mă predau
Şi-a mea inimă Ţi-o dau,
Doamne bun, întinde-Ţi mâna-asupra mea!

Când drumul vieţii e greu
Iar crucea îmi pare grea,
Atunci cu gândul la Calvar
Eu las povara mea.
Diavolul în orice zi
De necaz nu m-ar scuti,
/:Doamne bun, întinde-Ţi mâna-asupra mea!:/', null, 'Import automat din PPTX; necesita verificare manuala.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '002 Cand furtuni in viata-mi vin.pptx', 'pptx', 'needs_review', 'Când furtuni în viaţă-mi vin
Pe acest pământ străin,
Doamne bun, întinde-Ţi mâna-asupra mea!
Pe genunchi, în rugă-ţi cer
Să-mi ajuţi Tu către cer,
Doamne bun, întinde-Ţi mâna-asupra mea!

Când drumul vieţii e greu
Iar crucea îmi pare grea,
Atunci cu gândul la Calvar
Eu las povara mea.
Diavolul în orice zi
De necaz nu m-ar scuti,
Doamne bun, întinde-Ţi mâna-asupra mea!

Când duşmani în cale-mi stau
Pe Isus drept scut îl iau,
Doamne bun, întinde-Ţi mâna-asupra mea!
Doamne, Ţie mă predau
Şi-a mea inimă Ţi-o dau,
Doamne bun, întinde-Ţi mâna-asupra mea!

Când drumul vieţii e greu
Iar crucea îmi pare grea,
Atunci cu gândul la Calvar
Eu las povara mea.
Diavolul în orice zi
De necaz nu m-ar scuti,
/:Doamne bun, întinde-Ţi mâna-asupra mea!:/', 'Import automat din PPTX; necesita verificare manuala.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '002', 'Când furtuni în viaţă-mi vin', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Când furtuni în viaţă-mi vin
Pe acest pământ străin,
Doamne bun, întinde-Ţi mâna-asupra mea!
Pe genunchi, în rugă-ţi cer
Să-mi ajuţi Tu către cer,
Doamne bun, întinde-Ţi mâna-asupra mea!'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '002' and ss.source_title = 'Când furtuni în viaţă-mi vin'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'Când drumul vieţii e greu
Iar crucea îmi pare grea,
Atunci cu gândul la Calvar
Eu las povara mea.
Diavolul în orice zi
De necaz nu m-ar scuti,
Doamne bun, întinde-Ţi mâna-asupra mea!'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '002' and ss.source_title = 'Când furtuni în viaţă-mi vin'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Când duşmani în cale-mi stau
Pe Isus drept scut îl iau,
Doamne bun, întinde-Ţi mâna-asupra mea!
Doamne, Ţie mă predau
Şi-a mea inimă Ţi-o dau,
Doamne bun, întinde-Ţi mâna-asupra mea!'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '002' and ss.source_title = 'Când furtuni în viaţă-mi vin'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, 'Când drumul vieţii e greu
Iar crucea îmi pare grea,
Atunci cu gândul la Calvar
Eu las povara mea.
Diavolul în orice zi
De necaz nu m-ar scuti,
/:Doamne bun, întinde-Ţi mâna-asupra mea!:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '002' and ss.source_title = 'Când furtuni în viaţă-mi vin'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('El este domn si domneste in ceruri', '1. EI este Domn şi domneşte în ceruri 003
/: EI este Domn şi domneşte în ceruri
El este Domn.
Întunericului i-a zis: „Să fii Lumină!”
El este Domn.:/

R. EI este Domn şi domneşte în ceruri 003
Arată-Ţi puterea, o Domnul meu!
Arată-Ţi puterea, o Domnul meu!
O, Domnul meu!

2. EI este Domn şi domneşte în ceruri 003
Cine-i ca El? N-are sfârşit la zile,
El este Domn.
Prin a Sa-ndurare avem mântuire,
El este Domn.

R. EI este Domn şi domneşte în ceruri 003
Arată-Ţi puterea, o Domnul meu!
Arată-Ţi puterea, o Domnul meu!
O, Domnul meu!

3. EI este Domn şi domneşte în ceruri 003
El vine-n putere când chemi
al Său Nume,
E Dumnezeu.
Pe cei păcătoşi înainte-I aducem,
E Dumnezeu.

R. EI este Domn şi domneşte în ceruri 003
/:Arată-Ţi puterea, o Domnul meu!
Arată-Ţi puterea, o Domnul meu!:/
O, Domnul meu!', null, 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '003 El este domn si domneste in ceruri.pptx', 'pptx', 'needs_review', '1. EI este Domn şi domneşte în ceruri 003
/: EI este Domn şi domneşte în ceruri
El este Domn.
Întunericului i-a zis: „Să fii Lumină!”
El este Domn.:/

R. EI este Domn şi domneşte în ceruri 003
Arată-Ţi puterea, o Domnul meu!
Arată-Ţi puterea, o Domnul meu!
O, Domnul meu!

2. EI este Domn şi domneşte în ceruri 003
Cine-i ca El? N-are sfârşit la zile,
El este Domn.
Prin a Sa-ndurare avem mântuire,
El este Domn.

R. EI este Domn şi domneşte în ceruri 003
Arată-Ţi puterea, o Domnul meu!
Arată-Ţi puterea, o Domnul meu!
O, Domnul meu!

3. EI este Domn şi domneşte în ceruri 003
El vine-n putere când chemi
al Său Nume,
E Dumnezeu.
Pe cei păcătoşi înainte-I aducem,
E Dumnezeu.

R. EI este Domn şi domneşte în ceruri 003
/:Arată-Ţi puterea, o Domnul meu!
Arată-Ţi puterea, o Domnul meu!:/
O, Domnul meu!', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '003', 'El este domn si domneste in ceruri', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, '1. EI este Domn şi domneşte în ceruri 003
/: EI este Domn şi domneşte în ceruri
El este Domn.
Întunericului i-a zis: „Să fii Lumină!”
El este Domn.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '003' and ss.source_title = 'El este domn si domneste in ceruri'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'R. EI este Domn şi domneşte în ceruri 003
Arată-Ţi puterea, o Domnul meu!
Arată-Ţi puterea, o Domnul meu!
O, Domnul meu!'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '003' and ss.source_title = 'El este domn si domneste in ceruri'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, '2. EI este Domn şi domneşte în ceruri 003
Cine-i ca El? N-are sfârşit la zile,
El este Domn.
Prin a Sa-ndurare avem mântuire,
El este Domn.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '003' and ss.source_title = 'El este domn si domneste in ceruri'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, 'R. EI este Domn şi domneşte în ceruri 003
Arată-Ţi puterea, o Domnul meu!
Arată-Ţi puterea, o Domnul meu!
O, Domnul meu!'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '003' and ss.source_title = 'El este domn si domneste in ceruri'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '3', 5, '3. EI este Domn şi domneşte în ceruri 003
El vine-n putere când chemi
al Său Nume,
E Dumnezeu.
Pe cei păcătoşi înainte-I aducem,
E Dumnezeu.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '003' and ss.source_title = 'El este domn si domneste in ceruri'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 6, 'R. EI este Domn şi domneşte în ceruri 003
/:Arată-Ţi puterea, o Domnul meu!
Arată-Ţi puterea, o Domnul meu!:/
O, Domnul meu!'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '003' and ss.source_title = 'El este domn si domneste in ceruri'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Iata-ma naintea Ta', 'R. lată-mă ''naintea Ta 004
/: lată-mă ''naintea Ta
Mâini spre cer ridicând curate,
lată-mă dându-Ţi slavă
Pentru lucrările-Ţi toate.:/

1. lată-mă ''naintea Ta 004
N-am crezut vreodată
Să fie-aşa frumos.
N-am crezut vreodată
Că-Ţi pot fi de folos.
Dar m-ai găsit, Te-ai dat pentru al meu păcat
Şi m-ai primit cu dragoste ca pe un fiu iertat.

R. lată-mă ''naintea Ta 004
lată-mă ''naintea Ta
Mâini spre cer ridicând curate,
lată-mă dându-Ţi slavă
Pentru lucrările-Ţi toate.

2. lată-mă ''naintea Ta 004
N-am ştiut vreodată
Să-ţi spun tot ce simt
Şi nu ştiu
Cum să-Ţi mulţumesc.
Dar m-ai găsit, Te-ai dat pentru al meu păcat
Şi m-ai primit cu dragoste ca pe un fiu iertat.

R. lată-mă ''naintea Ta 004
/: lată-mă ''naintea Ta
Mâini spre cer ridicând curate,
lată-mă dându-Ţi slavă
Pentru lucrările-Ţi toate.:/
lată-mă ''naintea Ta...', null, 'Import automat din PPTX; necesita verificare manuala.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '004 Iata-ma naintea Ta.pptx', 'pptx', 'needs_review', 'R. lată-mă ''naintea Ta 004
/: lată-mă ''naintea Ta
Mâini spre cer ridicând curate,
lată-mă dându-Ţi slavă
Pentru lucrările-Ţi toate.:/

1. lată-mă ''naintea Ta 004
N-am crezut vreodată
Să fie-aşa frumos.
N-am crezut vreodată
Că-Ţi pot fi de folos.
Dar m-ai găsit, Te-ai dat pentru al meu păcat
Şi m-ai primit cu dragoste ca pe un fiu iertat.

R. lată-mă ''naintea Ta 004
lată-mă ''naintea Ta
Mâini spre cer ridicând curate,
lată-mă dându-Ţi slavă
Pentru lucrările-Ţi toate.

2. lată-mă ''naintea Ta 004
N-am ştiut vreodată
Să-ţi spun tot ce simt
Şi nu ştiu
Cum să-Ţi mulţumesc.
Dar m-ai găsit, Te-ai dat pentru al meu păcat
Şi m-ai primit cu dragoste ca pe un fiu iertat.

R. lată-mă ''naintea Ta 004
/: lată-mă ''naintea Ta
Mâini spre cer ridicând curate,
lată-mă dându-Ţi slavă
Pentru lucrările-Ţi toate.:/
lată-mă ''naintea Ta...', 'Import automat din PPTX; necesita verificare manuala.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '004', 'Iata-ma naintea Ta', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 1, 'R. lată-mă ''naintea Ta 004
/: lată-mă ''naintea Ta
Mâini spre cer ridicând curate,
lată-mă dându-Ţi slavă
Pentru lucrările-Ţi toate.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '004' and ss.source_title = 'Iata-ma naintea Ta'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 2, '1. lată-mă ''naintea Ta 004
N-am crezut vreodată
Să fie-aşa frumos.
N-am crezut vreodată
Că-Ţi pot fi de folos.
Dar m-ai găsit, Te-ai dat pentru al meu păcat
Şi m-ai primit cu dragoste ca pe un fiu iertat.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '004' and ss.source_title = 'Iata-ma naintea Ta'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 3, 'R. lată-mă ''naintea Ta 004
lată-mă ''naintea Ta
Mâini spre cer ridicând curate,
lată-mă dându-Ţi slavă
Pentru lucrările-Ţi toate.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '004' and ss.source_title = 'Iata-ma naintea Ta'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 4, '2. lată-mă ''naintea Ta 004
N-am ştiut vreodată
Să-ţi spun tot ce simt
Şi nu ştiu
Cum să-Ţi mulţumesc.
Dar m-ai găsit, Te-ai dat pentru al meu păcat
Şi m-ai primit cu dragoste ca pe un fiu iertat.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '004' and ss.source_title = 'Iata-ma naintea Ta'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 5, 'R. lată-mă ''naintea Ta 004
/: lată-mă ''naintea Ta
Mâini spre cer ridicând curate,
lată-mă dându-Ţi slavă
Pentru lucrările-Ţi toate.:/
lată-mă ''naintea Ta...'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '004' and ss.source_title = 'Iata-ma naintea Ta'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Al meu Domn, Părinte', 'Al meu Domn, Părinte, nimeni ca Tine nu e,
Cât voi trăi Îţi voi slăvi
Lucrarea mâinilor Tale.
Refugiu, scăpare în braţul Tău eu găsesc,
Prin gura mea, cu tot ce am,
Totdeauna laudă-Ţi voi da.

Strig către Tine, o, Doamne, Te caut,
Tu eşti împăratul, puterea Ţi-o laud,
Munţii se pleacă şi mările tac
Când rostim Numele Tău.
Tot ce-ai creat în splendoare azi stă,
Eu veşnic mă-nchin şi îţi dau laudă,
Prin Tine exist şi prin harul Tău sfânt, EU SUNT.

Al meu Domn, Părinte, nimeni ca Tine nu e,
Cât voi trăi Îţi voi slăvi lucrarea mâinilor Tale.
Refugiu, scăpare în braţul Tău eu găsesc,
Prin gura mea, cu tot ce am,
Totdeauna laudă-Ţi voi da.

/:Strig către Tine, o, Doamne, Te caut,
Tu eşti împăratul, puterea Ţi-o laud,
Munţii se pleacă şi mările tac
Când rostim Numele Tău.
Tot ce-ai creat în splendoare azi stă,
Eu veşnic mă-nchin şi îţi dau laudă,
/:Prin Tine exist şi prin harul Tău sfânt, EU SUNT.:/ X3', null, 'Import automat din PPTX; necesita verificare manuala.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '005 Al meu Domn, Parinte.pptx', 'pptx', 'needs_review', 'Al meu Domn, Părinte, nimeni ca Tine nu e,
Cât voi trăi Îţi voi slăvi
Lucrarea mâinilor Tale.
Refugiu, scăpare în braţul Tău eu găsesc,
Prin gura mea, cu tot ce am,
Totdeauna laudă-Ţi voi da.

Strig către Tine, o, Doamne, Te caut,
Tu eşti împăratul, puterea Ţi-o laud,
Munţii se pleacă şi mările tac
Când rostim Numele Tău.
Tot ce-ai creat în splendoare azi stă,
Eu veşnic mă-nchin şi îţi dau laudă,
Prin Tine exist şi prin harul Tău sfânt, EU SUNT.

Al meu Domn, Părinte, nimeni ca Tine nu e,
Cât voi trăi Îţi voi slăvi lucrarea mâinilor Tale.
Refugiu, scăpare în braţul Tău eu găsesc,
Prin gura mea, cu tot ce am,
Totdeauna laudă-Ţi voi da.

/:Strig către Tine, o, Doamne, Te caut,
Tu eşti împăratul, puterea Ţi-o laud,
Munţii se pleacă şi mările tac
Când rostim Numele Tău.
Tot ce-ai creat în splendoare azi stă,
Eu veşnic mă-nchin şi îţi dau laudă,
/:Prin Tine exist şi prin harul Tău sfânt, EU SUNT.:/ X3', 'Import automat din PPTX; necesita verificare manuala.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '005', 'Al meu Domn, Părinte', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Al meu Domn, Părinte, nimeni ca Tine nu e,
Cât voi trăi Îţi voi slăvi
Lucrarea mâinilor Tale.
Refugiu, scăpare în braţul Tău eu găsesc,
Prin gura mea, cu tot ce am,
Totdeauna laudă-Ţi voi da.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '005' and ss.source_title = 'Al meu Domn, Părinte'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'Strig către Tine, o, Doamne, Te caut,
Tu eşti împăratul, puterea Ţi-o laud,
Munţii se pleacă şi mările tac
Când rostim Numele Tău.
Tot ce-ai creat în splendoare azi stă,
Eu veşnic mă-nchin şi îţi dau laudă,
Prin Tine exist şi prin harul Tău sfânt, EU SUNT.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '005' and ss.source_title = 'Al meu Domn, Părinte'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Al meu Domn, Părinte, nimeni ca Tine nu e,
Cât voi trăi Îţi voi slăvi lucrarea mâinilor Tale.
Refugiu, scăpare în braţul Tău eu găsesc,
Prin gura mea, cu tot ce am,
Totdeauna laudă-Ţi voi da.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '005' and ss.source_title = 'Al meu Domn, Părinte'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, '/:Strig către Tine, o, Doamne, Te caut,
Tu eşti împăratul, puterea Ţi-o laud,
Munţii se pleacă şi mările tac
Când rostim Numele Tău.
Tot ce-ai creat în splendoare azi stă,
Eu veşnic mă-nchin şi îţi dau laudă,
/:Prin Tine exist şi prin harul Tău sfânt, EU SUNT.:/ X3'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '005' and ss.source_title = 'Al meu Domn, Părinte'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Doamne, azi eu vin', 'Doamne, azi eu vin
În faţa Ta să mă închin
Şi să fiu umplut de har divin.
Prin iubirea Ta aş vrea mai mult
Să îmi cunosc slăbiciunile
Şi să cresc în iubirea Ta.

Cheamă-mă şi voi veni la Tine,
Când sunt slab Tu mă întăreşti.
Ca vulturul spre cer mă voi înălţa
Şi veşnic voi trăi, mereu voi locui
Prin iubirea Ta.

Doamne, vreau să fiu
În stare să-nţeleg cum eşti
Şi care-i calea Ta, să merg pe ea.
Şi din pacea Ta, în suflet să-mi reverşi
Un strop
Ca cei din jur să bea şi să stea
În iubirea Ta.

Cheamă-mă şi voi veni la Tine,
Când sunt slab Tu mă întăreşti.
Ca vulturul spre cer mă voi înălţa
Şi veşnic voi trăi, mereu voi locui
Prin iubirea Ta.

Cheamă-mă şi voi veni la Tine,
Când sunt slab Tu mă întăreşti.
Ca vulturul spre cer mă voi înălţa
/: Şi veşnic voi trăi, mereu voi locui
Prin iubirea Ta.:/', null, 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '006 Doamne, azi eu vin.pptx', 'pptx', 'needs_review', 'Doamne, azi eu vin
În faţa Ta să mă închin
Şi să fiu umplut de har divin.
Prin iubirea Ta aş vrea mai mult
Să îmi cunosc slăbiciunile
Şi să cresc în iubirea Ta.

Cheamă-mă şi voi veni la Tine,
Când sunt slab Tu mă întăreşti.
Ca vulturul spre cer mă voi înălţa
Şi veşnic voi trăi, mereu voi locui
Prin iubirea Ta.

Doamne, vreau să fiu
În stare să-nţeleg cum eşti
Şi care-i calea Ta, să merg pe ea.
Şi din pacea Ta, în suflet să-mi reverşi
Un strop
Ca cei din jur să bea şi să stea
În iubirea Ta.

Cheamă-mă şi voi veni la Tine,
Când sunt slab Tu mă întăreşti.
Ca vulturul spre cer mă voi înălţa
Şi veşnic voi trăi, mereu voi locui
Prin iubirea Ta.

Cheamă-mă şi voi veni la Tine,
Când sunt slab Tu mă întăreşti.
Ca vulturul spre cer mă voi înălţa
/: Şi veşnic voi trăi, mereu voi locui
Prin iubirea Ta.:/', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '006', 'Doamne, azi eu vin', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Doamne, azi eu vin
În faţa Ta să mă închin
Şi să fiu umplut de har divin.
Prin iubirea Ta aş vrea mai mult
Să îmi cunosc slăbiciunile
Şi să cresc în iubirea Ta.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '006' and ss.source_title = 'Doamne, azi eu vin'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'Cheamă-mă şi voi veni la Tine,
Când sunt slab Tu mă întăreşti.
Ca vulturul spre cer mă voi înălţa
Şi veşnic voi trăi, mereu voi locui
Prin iubirea Ta.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '006' and ss.source_title = 'Doamne, azi eu vin'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Doamne, vreau să fiu
În stare să-nţeleg cum eşti
Şi care-i calea Ta, să merg pe ea.
Şi din pacea Ta, în suflet să-mi reverşi
Un strop
Ca cei din jur să bea şi să stea
În iubirea Ta.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '006' and ss.source_title = 'Doamne, azi eu vin'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, 'Cheamă-mă şi voi veni la Tine,
Când sunt slab Tu mă întăreşti.
Ca vulturul spre cer mă voi înălţa
Şi veşnic voi trăi, mereu voi locui
Prin iubirea Ta.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '006' and ss.source_title = 'Doamne, azi eu vin'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 5, 'Cheamă-mă şi voi veni la Tine,
Când sunt slab Tu mă întăreşti.
Ca vulturul spre cer mă voi înălţa
/: Şi veşnic voi trăi, mereu voi locui
Prin iubirea Ta.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '006' and ss.source_title = 'Doamne, azi eu vin'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('O lume întreagă stă în nepăsare', 'O lume întreagă stă în nepăsare
Şi caută adăpost când vine o-ncercare,
Dar eu nu mă tem, dar eu nu mă tem.
În ceasul cel bun e stăpână pe toate,
Când Domnul îi vorbeşte - i-e frică de moarte,
Dar eu nu mă tem, dar eu nu mă tem.

Dar eu nu mă tem,
Chiar dacă cei din jur mă părăsesc,
Dar eu nu mă tem orice-ar veni.
Viaţa mea
E-n mâna Celui ce-a murit pe lemn,
Cu mine Îl chem şi eu nu mă tem.

Ades’ vine-ncercarea năvalnic ca marea,
Şi norii negri grabnic întunecă zarea.
Dar eu nu mă tem, dar eu nu mă tem.
Se spulberă gândul şi orice speranţă,
Şi nici măcar o clipă nu ai siguranţă,
Dar eu nu mă tem, dar eu nu mă tem.

Dar eu nu mă tem,
Chiar dacă cei din jur mă părăsesc,
Dar eu nu mă tem orice-ar veni.
Viaţa mea
E-n mâna Celui ce-a murit pe lemn,
Cu mine Îl chem şi eu nu mă tem.

Chiar oamenii cei răi mă-nconjoară cu ură,
Din cupa lor să-mi dea să beau o picătură,
Dar eu nu mă tem, dar eu nu mă tem.
Cu Domnul meu eu trec biruitor prin toate,
Din apă şi din foc să mă scape El poate,
Dar eu nu mă tem, dar eu nu mă tem.

/:Dar eu nu mă tem,
Chiar dacă cei din jur mă părăsesc,
Dar eu nu mă tem orice-ar veni.
Viaţa mea
E-n mâna Celui ce-a murit pe lemn,
Cu mine Îl chem şi eu nu mă tem.:/', 'D', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '007 O lume intreaga sta in nepasare.pptx', 'pptx', 'needs_review', 'O lume întreagă stă în nepăsare
Şi caută adăpost când vine o-ncercare,
Dar eu nu mă tem, dar eu nu mă tem.
În ceasul cel bun e stăpână pe toate,
Când Domnul îi vorbeşte - i-e frică de moarte,
Dar eu nu mă tem, dar eu nu mă tem.

Dar eu nu mă tem,
Chiar dacă cei din jur mă părăsesc,
Dar eu nu mă tem orice-ar veni.
Viaţa mea
E-n mâna Celui ce-a murit pe lemn,
Cu mine Îl chem şi eu nu mă tem.

Ades’ vine-ncercarea năvalnic ca marea,
Şi norii negri grabnic întunecă zarea.
Dar eu nu mă tem, dar eu nu mă tem.
Se spulberă gândul şi orice speranţă,
Şi nici măcar o clipă nu ai siguranţă,
Dar eu nu mă tem, dar eu nu mă tem.

Dar eu nu mă tem,
Chiar dacă cei din jur mă părăsesc,
Dar eu nu mă tem orice-ar veni.
Viaţa mea
E-n mâna Celui ce-a murit pe lemn,
Cu mine Îl chem şi eu nu mă tem.

Chiar oamenii cei răi mă-nconjoară cu ură,
Din cupa lor să-mi dea să beau o picătură,
Dar eu nu mă tem, dar eu nu mă tem.
Cu Domnul meu eu trec biruitor prin toate,
Din apă şi din foc să mă scape El poate,
Dar eu nu mă tem, dar eu nu mă tem.

/:Dar eu nu mă tem,
Chiar dacă cei din jur mă părăsesc,
Dar eu nu mă tem orice-ar veni.
Viaţa mea
E-n mâna Celui ce-a murit pe lemn,
Cu mine Îl chem şi eu nu mă tem.:/', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '007', 'O lume întreagă stă în nepăsare', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'O lume întreagă stă în nepăsare
Şi caută adăpost când vine o-ncercare,
Dar eu nu mă tem, dar eu nu mă tem.
În ceasul cel bun e stăpână pe toate,
Când Domnul îi vorbeşte - i-e frică de moarte,
Dar eu nu mă tem, dar eu nu mă tem.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '007' and ss.source_title = 'O lume întreagă stă în nepăsare'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'Dar eu nu mă tem,
Chiar dacă cei din jur mă părăsesc,
Dar eu nu mă tem orice-ar veni.
Viaţa mea
E-n mâna Celui ce-a murit pe lemn,
Cu mine Îl chem şi eu nu mă tem.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '007' and ss.source_title = 'O lume întreagă stă în nepăsare'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Ades’ vine-ncercarea năvalnic ca marea,
Şi norii negri grabnic întunecă zarea.
Dar eu nu mă tem, dar eu nu mă tem.
Se spulberă gândul şi orice speranţă,
Şi nici măcar o clipă nu ai siguranţă,
Dar eu nu mă tem, dar eu nu mă tem.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '007' and ss.source_title = 'O lume întreagă stă în nepăsare'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, 'Dar eu nu mă tem,
Chiar dacă cei din jur mă părăsesc,
Dar eu nu mă tem orice-ar veni.
Viaţa mea
E-n mâna Celui ce-a murit pe lemn,
Cu mine Îl chem şi eu nu mă tem.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '007' and ss.source_title = 'O lume întreagă stă în nepăsare'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '3', 5, 'Chiar oamenii cei răi mă-nconjoară cu ură,
Din cupa lor să-mi dea să beau o picătură,
Dar eu nu mă tem, dar eu nu mă tem.
Cu Domnul meu eu trec biruitor prin toate,
Din apă şi din foc să mă scape El poate,
Dar eu nu mă tem, dar eu nu mă tem.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '007' and ss.source_title = 'O lume întreagă stă în nepăsare'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 6, '/:Dar eu nu mă tem,
Chiar dacă cei din jur mă părăsesc,
Dar eu nu mă tem orice-ar veni.
Viaţa mea
E-n mâna Celui ce-a murit pe lemn,
Cu mine Îl chem şi eu nu mă tem.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '007' and ss.source_title = 'O lume întreagă stă în nepăsare'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Suntem prin Domnul Isus', 'Suntem prin Domnul Isus popor de biruinţă,
Ne-a dat iertarea în sângele Lui,
Cântăm cu bucurie şi cu recunoştinţă,
Suntem pe veci copii ai Mielului.
Suntem chiar în ispite popor de biruinţă,
Dar chiar puţini noi unitari vom fi
Şi nu pe altă cale ci numai prin credinţă
Putea-vom pân’ la capăt birui.

/: Noi ştim că Domnul Isus vine Să ne ia la Sine,
Ştim că slava ne-o va da,
A Sa împărăţie, cununa vieţii vie,
Credinţa şi dragostea Sa.
În cer nu va mai fi tristeţe, lacrimi, bătrâneţe,
Cu Isus când noi vom fi,
Va fi doar veşnicia, pacea, bucuria
În veci vor dăinui.:/

Suntem prin Domnul Isus popor de biruinţă,
Ne-a dat iertarea în sângele Lui,
Cântăm cu bucurie şi cu recunoştinţă,
Suntem pe veci copii ai Mielului.
Suntem chiar în ispite popor de biruinţă,
Dar chiar puţini noi unitari vom fi
Şi nu pe altă cale ci numai prin credinţă
Putea-vom pân’ la capăt birui.

/: Noi ştim că Domnul Isus vine Să ne ia la Sine,
Ştim că slava ne-o va da,
A Sa împărăţie, cununa vieţii vie,
Credinţa şi dragostea Sa.
În cer nu va mai fi tristeţe, lacrimi, bătrâneţe,
Cu Isus când noi vom fi,
Va fi doar veşnicia, pacea, bucuria
În veci vor dăinui.:/', 'F', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '008 Suntem prin Domnul Isus.pptx', 'pptx', 'needs_review', 'Suntem prin Domnul Isus popor de biruinţă,
Ne-a dat iertarea în sângele Lui,
Cântăm cu bucurie şi cu recunoştinţă,
Suntem pe veci copii ai Mielului.
Suntem chiar în ispite popor de biruinţă,
Dar chiar puţini noi unitari vom fi
Şi nu pe altă cale ci numai prin credinţă
Putea-vom pân’ la capăt birui.

/: Noi ştim că Domnul Isus vine Să ne ia la Sine,
Ştim că slava ne-o va da,
A Sa împărăţie, cununa vieţii vie,
Credinţa şi dragostea Sa.
În cer nu va mai fi tristeţe, lacrimi, bătrâneţe,
Cu Isus când noi vom fi,
Va fi doar veşnicia, pacea, bucuria
În veci vor dăinui.:/

Suntem prin Domnul Isus popor de biruinţă,
Ne-a dat iertarea în sângele Lui,
Cântăm cu bucurie şi cu recunoştinţă,
Suntem pe veci copii ai Mielului.
Suntem chiar în ispite popor de biruinţă,
Dar chiar puţini noi unitari vom fi
Şi nu pe altă cale ci numai prin credinţă
Putea-vom pân’ la capăt birui.

/: Noi ştim că Domnul Isus vine Să ne ia la Sine,
Ştim că slava ne-o va da,
A Sa împărăţie, cununa vieţii vie,
Credinţa şi dragostea Sa.
În cer nu va mai fi tristeţe, lacrimi, bătrâneţe,
Cu Isus când noi vom fi,
Va fi doar veşnicia, pacea, bucuria
În veci vor dăinui.:/', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '008', 'Suntem prin Domnul Isus', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Suntem prin Domnul Isus popor de biruinţă,
Ne-a dat iertarea în sângele Lui,
Cântăm cu bucurie şi cu recunoştinţă,
Suntem pe veci copii ai Mielului.
Suntem chiar în ispite popor de biruinţă,
Dar chiar puţini noi unitari vom fi
Şi nu pe altă cale ci numai prin credinţă
Putea-vom pân’ la capăt birui.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '008' and ss.source_title = 'Suntem prin Domnul Isus'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, '/: Noi ştim că Domnul Isus vine Să ne ia la Sine,
Ştim că slava ne-o va da,
A Sa împărăţie, cununa vieţii vie,
Credinţa şi dragostea Sa.
În cer nu va mai fi tristeţe, lacrimi, bătrâneţe,
Cu Isus când noi vom fi,
Va fi doar veşnicia, pacea, bucuria
În veci vor dăinui.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '008' and ss.source_title = 'Suntem prin Domnul Isus'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Suntem prin Domnul Isus popor de biruinţă,
Ne-a dat iertarea în sângele Lui,
Cântăm cu bucurie şi cu recunoştinţă,
Suntem pe veci copii ai Mielului.
Suntem chiar în ispite popor de biruinţă,
Dar chiar puţini noi unitari vom fi
Şi nu pe altă cale ci numai prin credinţă
Putea-vom pân’ la capăt birui.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '008' and ss.source_title = 'Suntem prin Domnul Isus'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, '/: Noi ştim că Domnul Isus vine Să ne ia la Sine,
Ştim că slava ne-o va da,
A Sa împărăţie, cununa vieţii vie,
Credinţa şi dragostea Sa.
În cer nu va mai fi tristeţe, lacrimi, bătrâneţe,
Cu Isus când noi vom fi,
Va fi doar veşnicia, pacea, bucuria
În veci vor dăinui.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '008' and ss.source_title = 'Suntem prin Domnul Isus'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Ochii Domnului, plini de dragoste privesc', 'Ochii Domnului, plini de dragoste privesc,
Inimile tuturor care nu-L cunosc.
Mâna Domnului întinsă e şi azi spre noi,
Întinde mâna ta şi tu, nu mai privi ''napoi.
Înapoi de mergi nu mai ai ce întâlni,
Doar viaţa plină de necaz.
Întoarce-te la Domnul azi!

Şopteşte: „Iartă-mă, ia vina mea!”,
Isus e lângă tine, vrea să intre-n viaţa ta.
Şopteşte: „Iartă-mă, ia vina mea!”,
Isus e lângă tine, vrea să intre-n viaţa ta.

Ochii Domnului, plini de dragoste privesc,
Inimile tuturor care nu-L cunosc.
Mâna Domnului întinsă e şi azi spre noi,
Întinde mâna ta şi tu, nu mai privi ''napoi.
Înapoi de mergi nu mai ai ce întâlni,
Doar viaţa plină de necaz.
Întoarce-te la Domnul azi!

/:Şopteşte: „Iartă-mă, ia vina mea!”,
Isus e lângă tine, vrea să intre-n viaţa ta.
Şopteşte: „Iartă-mă, ia vina mea!”,
Isus e lângă tine, vrea să intre-n viaţa ta.:/ X2', 'G', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '009 Ochii Domnului plini de dragoste privesc.pptx', 'pptx', 'needs_review', 'Ochii Domnului, plini de dragoste privesc,
Inimile tuturor care nu-L cunosc.
Mâna Domnului întinsă e şi azi spre noi,
Întinde mâna ta şi tu, nu mai privi ''napoi.
Înapoi de mergi nu mai ai ce întâlni,
Doar viaţa plină de necaz.
Întoarce-te la Domnul azi!

Şopteşte: „Iartă-mă, ia vina mea!”,
Isus e lângă tine, vrea să intre-n viaţa ta.
Şopteşte: „Iartă-mă, ia vina mea!”,
Isus e lângă tine, vrea să intre-n viaţa ta.

Ochii Domnului, plini de dragoste privesc,
Inimile tuturor care nu-L cunosc.
Mâna Domnului întinsă e şi azi spre noi,
Întinde mâna ta şi tu, nu mai privi ''napoi.
Înapoi de mergi nu mai ai ce întâlni,
Doar viaţa plină de necaz.
Întoarce-te la Domnul azi!

/:Şopteşte: „Iartă-mă, ia vina mea!”,
Isus e lângă tine, vrea să intre-n viaţa ta.
Şopteşte: „Iartă-mă, ia vina mea!”,
Isus e lângă tine, vrea să intre-n viaţa ta.:/ X2', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '009', 'Ochii Domnului, plini de dragoste privesc', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Ochii Domnului, plini de dragoste privesc,
Inimile tuturor care nu-L cunosc.
Mâna Domnului întinsă e şi azi spre noi,
Întinde mâna ta şi tu, nu mai privi ''napoi.
Înapoi de mergi nu mai ai ce întâlni,
Doar viaţa plină de necaz.
Întoarce-te la Domnul azi!'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '009' and ss.source_title = 'Ochii Domnului, plini de dragoste privesc'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'Şopteşte: „Iartă-mă, ia vina mea!”,
Isus e lângă tine, vrea să intre-n viaţa ta.
Şopteşte: „Iartă-mă, ia vina mea!”,
Isus e lângă tine, vrea să intre-n viaţa ta.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '009' and ss.source_title = 'Ochii Domnului, plini de dragoste privesc'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 3, 'Ochii Domnului, plini de dragoste privesc,
Inimile tuturor care nu-L cunosc.
Mâna Domnului întinsă e şi azi spre noi,
Întinde mâna ta şi tu, nu mai privi ''napoi.
Înapoi de mergi nu mai ai ce întâlni,
Doar viaţa plină de necaz.
Întoarce-te la Domnul azi!'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '009' and ss.source_title = 'Ochii Domnului, plini de dragoste privesc'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, '/:Şopteşte: „Iartă-mă, ia vina mea!”,
Isus e lângă tine, vrea să intre-n viaţa ta.
Şopteşte: „Iartă-mă, ia vina mea!”,
Isus e lângă tine, vrea să intre-n viaţa ta.:/ X2'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '009' and ss.source_title = 'Ochii Domnului, plini de dragoste privesc'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('În casa Ta, Doamne, aud Cuvântul Sfânt', 'În casa Ta, Doamne, aud Cuvântul Sfânt
Şi nu-i loc mai ales niciunde pe pământ.
Cuvântul Tău e plin de-nvăţături şi har
Căci El e DA, AMIN! şi nu-i spus în zadar.

O zi cu Tine, dă bucurii depline
Şi răsplătiri divine,
Când simţi al Duhului Sfânt foc.
O zi cu Tine, Doamne, eu ştiu prea bine,
Mai mult e pentru mine decât o mie în alt loc.

În casa Ta, Doamne, aud cântări şi vers
Cum nu mai pot s-aud niciunde-n univers,
Şi sufletu-mi nu vrea din alt izvor să bea;
Decât din cel divin, izvor din casa Ta.

O zi cu Tine, dă bucurii depline
Şi răsplătiri divine,
Când simţi al Duhului Sfânt foc.
O zi cu Tine, Doamne, eu ştiu prea bine,
Mai mult e pentru mine decât o mie în alt loc.

În casa Ta, Doamne, genunchiul când mi-l plec,
Clipe de părtăşii cu Tine eu petrec,
Şi simt cum torni din plin în vasul însetat,
La glasul Tău, „Amin!” răspund neîncetat.

O zi cu Tine, dă bucurii depline
Şi răsplătiri divine,
Când simţi al Duhului Sfânt foc.
O zi cu Tine, Doamne, eu ştiu prea bine,
Mai mult e pentru mine decât o mie în alt loc.', 'G', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '010 In Casa Ta, Doamne, aud Cuvantul Sfant.pptx', 'pptx', 'needs_review', 'În casa Ta, Doamne, aud Cuvântul Sfânt
Şi nu-i loc mai ales niciunde pe pământ.
Cuvântul Tău e plin de-nvăţături şi har
Căci El e DA, AMIN! şi nu-i spus în zadar.

O zi cu Tine, dă bucurii depline
Şi răsplătiri divine,
Când simţi al Duhului Sfânt foc.
O zi cu Tine, Doamne, eu ştiu prea bine,
Mai mult e pentru mine decât o mie în alt loc.

În casa Ta, Doamne, aud cântări şi vers
Cum nu mai pot s-aud niciunde-n univers,
Şi sufletu-mi nu vrea din alt izvor să bea;
Decât din cel divin, izvor din casa Ta.

O zi cu Tine, dă bucurii depline
Şi răsplătiri divine,
Când simţi al Duhului Sfânt foc.
O zi cu Tine, Doamne, eu ştiu prea bine,
Mai mult e pentru mine decât o mie în alt loc.

În casa Ta, Doamne, genunchiul când mi-l plec,
Clipe de părtăşii cu Tine eu petrec,
Şi simt cum torni din plin în vasul însetat,
La glasul Tău, „Amin!” răspund neîncetat.

O zi cu Tine, dă bucurii depline
Şi răsplătiri divine,
Când simţi al Duhului Sfânt foc.
O zi cu Tine, Doamne, eu ştiu prea bine,
Mai mult e pentru mine decât o mie în alt loc.', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '010', 'În casa Ta, Doamne, aud Cuvântul Sfânt', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'În casa Ta, Doamne, aud Cuvântul Sfânt
Şi nu-i loc mai ales niciunde pe pământ.
Cuvântul Tău e plin de-nvăţături şi har
Căci El e DA, AMIN! şi nu-i spus în zadar.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '010' and ss.source_title = 'În casa Ta, Doamne, aud Cuvântul Sfânt'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'O zi cu Tine, dă bucurii depline
Şi răsplătiri divine,
Când simţi al Duhului Sfânt foc.
O zi cu Tine, Doamne, eu ştiu prea bine,
Mai mult e pentru mine decât o mie în alt loc.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '010' and ss.source_title = 'În casa Ta, Doamne, aud Cuvântul Sfânt'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'În casa Ta, Doamne, aud cântări şi vers
Cum nu mai pot s-aud niciunde-n univers,
Şi sufletu-mi nu vrea din alt izvor să bea;
Decât din cel divin, izvor din casa Ta.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '010' and ss.source_title = 'În casa Ta, Doamne, aud Cuvântul Sfânt'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, 'O zi cu Tine, dă bucurii depline
Şi răsplătiri divine,
Când simţi al Duhului Sfânt foc.
O zi cu Tine, Doamne, eu ştiu prea bine,
Mai mult e pentru mine decât o mie în alt loc.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '010' and ss.source_title = 'În casa Ta, Doamne, aud Cuvântul Sfânt'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '3', 5, 'În casa Ta, Doamne, genunchiul când mi-l plec,
Clipe de părtăşii cu Tine eu petrec,
Şi simt cum torni din plin în vasul însetat,
La glasul Tău, „Amin!” răspund neîncetat.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '010' and ss.source_title = 'În casa Ta, Doamne, aud Cuvântul Sfânt'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 6, 'O zi cu Tine, dă bucurii depline
Şi răsplătiri divine,
Când simţi al Duhului Sfânt foc.
O zi cu Tine, Doamne, eu ştiu prea bine,
Mai mult e pentru mine decât o mie în alt loc.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '010' and ss.source_title = 'În casa Ta, Doamne, aud Cuvântul Sfânt'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Ne despărţim, la drum pornim', 'Ne despărţim, la drum pornim
|: Frumoase clipe s-au încheiat
Căci timpul trece neîncetat.
Fiţi bucuroşi, fiţi sănătoşi!:|

Pace şi har e-al nostru dar
|: Suntem în mâna Domnului
Ne poartă El după Voia Lui.
Fiţi bucuroşi, fiţi sănătoşi!:|

Fiţi bucuroşi! Fiţi sănătoşi!
|: Chiar dacă ultima oară-ar fi
Când pe pământ ne vom întâlni,
În cer dorim să ne-ntâlnim!:|', 'E', 'Import automat din PPTX; necesita verificare manuala.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '011 Ne despartim, la drum pornim.pptx', 'pptx', 'needs_review', 'Ne despărţim, la drum pornim
|: Frumoase clipe s-au încheiat
Căci timpul trece neîncetat.
Fiţi bucuroşi, fiţi sănătoşi!:|

Pace şi har e-al nostru dar
|: Suntem în mâna Domnului
Ne poartă El după Voia Lui.
Fiţi bucuroşi, fiţi sănătoşi!:|

Fiţi bucuroşi! Fiţi sănătoşi!
|: Chiar dacă ultima oară-ar fi
Când pe pământ ne vom întâlni,
În cer dorim să ne-ntâlnim!:|', 'Import automat din PPTX; necesita verificare manuala.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '011', 'Ne despărţim, la drum pornim', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Ne despărţim, la drum pornim
|: Frumoase clipe s-au încheiat
Căci timpul trece neîncetat.
Fiţi bucuroşi, fiţi sănătoşi!:|'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '011' and ss.source_title = 'Ne despărţim, la drum pornim'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 2, 'Pace şi har e-al nostru dar
|: Suntem în mâna Domnului
Ne poartă El după Voia Lui.
Fiţi bucuroşi, fiţi sănătoşi!:|'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '011' and ss.source_title = 'Ne despărţim, la drum pornim'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '3', 3, 'Fiţi bucuroşi! Fiţi sănătoşi!
|: Chiar dacă ultima oară-ar fi
Când pe pământ ne vom întâlni,
În cer dorim să ne-ntâlnim!:|'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '011' and ss.source_title = 'Ne despărţim, la drum pornim'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Eram jos în păcat, dar Isus m-a salvat', 'Eram jos în păcat, dar Isus m-a salvat,
Lumina Lui din cer în mine-a strălucit,
Scăldat în harul Său, eu am un nume nou,
Când stau de vorbă cu Isus sunt fericit.

Vino şi stai de vorbă azi cu Isus,
Vino, spune-l Lui ce griji te-apasă,
El să-ţi ia al tău suspin
Şi să-ţi dea pacea Sa din plin.
Când simţi că vrei să stai în rugăciune,
Când te arde-un dor şi nu-l poţi spune,
Numai pe genunchi lângă Isus eşti fericit.

Cărarea când e grea şi roze nu-s pe ea,
Şi norii de-ndoială soarele-au umbrit,
Când ceaţa de păcat cerul a-ntunecat,
Eu stau de vorbă cu Isus şi-s fericit.

Vino şi stai de vorbă azi cu Isus,
Vino, spune-l Lui ce griji te-apasă,
El să-ţi ia al tău suspin
Şi să-ţi dea pacea Sa din plin.
Când simţi că vrei să stai în rugăciune,
Când te arde-un dor şi nu-l poţi spune,
Numai pe genunchi lângă Isus eşti fericit.

Când umbrele se sting şi ochii mei când plâng,
Atunci Isus e-al meu Prieten neclintit,
În rugăciune ia povara mea cea grea,
Când stau de vorbă cu Isus sunt fericit.

Vino şi stai de vorbă azi cu Isus,
Vino, spune-l Lui ce griji te-apasă,
El să-ţi ia al tău suspin
Şi să-ţi dea pacea Sa din plin.
Când simţi că vrei să stai în rugăciune,
Când te arde-un dor şi nu-l poţi spune,
Numai pe genunchi lângă Isus eşti fericit.', 'A', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '012 Eram jos in pacat.pptx', 'pptx', 'needs_review', 'Eram jos în păcat, dar Isus m-a salvat,
Lumina Lui din cer în mine-a strălucit,
Scăldat în harul Său, eu am un nume nou,
Când stau de vorbă cu Isus sunt fericit.

Vino şi stai de vorbă azi cu Isus,
Vino, spune-l Lui ce griji te-apasă,
El să-ţi ia al tău suspin
Şi să-ţi dea pacea Sa din plin.
Când simţi că vrei să stai în rugăciune,
Când te arde-un dor şi nu-l poţi spune,
Numai pe genunchi lângă Isus eşti fericit.

Cărarea când e grea şi roze nu-s pe ea,
Şi norii de-ndoială soarele-au umbrit,
Când ceaţa de păcat cerul a-ntunecat,
Eu stau de vorbă cu Isus şi-s fericit.

Vino şi stai de vorbă azi cu Isus,
Vino, spune-l Lui ce griji te-apasă,
El să-ţi ia al tău suspin
Şi să-ţi dea pacea Sa din plin.
Când simţi că vrei să stai în rugăciune,
Când te arde-un dor şi nu-l poţi spune,
Numai pe genunchi lângă Isus eşti fericit.

Când umbrele se sting şi ochii mei când plâng,
Atunci Isus e-al meu Prieten neclintit,
În rugăciune ia povara mea cea grea,
Când stau de vorbă cu Isus sunt fericit.

Vino şi stai de vorbă azi cu Isus,
Vino, spune-l Lui ce griji te-apasă,
El să-ţi ia al tău suspin
Şi să-ţi dea pacea Sa din plin.
Când simţi că vrei să stai în rugăciune,
Când te arde-un dor şi nu-l poţi spune,
Numai pe genunchi lângă Isus eşti fericit.', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '012', 'Eram jos în păcat, dar Isus m-a salvat', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Eram jos în păcat, dar Isus m-a salvat,
Lumina Lui din cer în mine-a strălucit,
Scăldat în harul Său, eu am un nume nou,
Când stau de vorbă cu Isus sunt fericit.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '012' and ss.source_title = 'Eram jos în păcat, dar Isus m-a salvat'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'Vino şi stai de vorbă azi cu Isus,
Vino, spune-l Lui ce griji te-apasă,
El să-ţi ia al tău suspin
Şi să-ţi dea pacea Sa din plin.
Când simţi că vrei să stai în rugăciune,
Când te arde-un dor şi nu-l poţi spune,
Numai pe genunchi lângă Isus eşti fericit.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '012' and ss.source_title = 'Eram jos în păcat, dar Isus m-a salvat'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Cărarea când e grea şi roze nu-s pe ea,
Şi norii de-ndoială soarele-au umbrit,
Când ceaţa de păcat cerul a-ntunecat,
Eu stau de vorbă cu Isus şi-s fericit.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '012' and ss.source_title = 'Eram jos în păcat, dar Isus m-a salvat'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, 'Vino şi stai de vorbă azi cu Isus,
Vino, spune-l Lui ce griji te-apasă,
El să-ţi ia al tău suspin
Şi să-ţi dea pacea Sa din plin.
Când simţi că vrei să stai în rugăciune,
Când te arde-un dor şi nu-l poţi spune,
Numai pe genunchi lângă Isus eşti fericit.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '012' and ss.source_title = 'Eram jos în păcat, dar Isus m-a salvat'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '3', 5, 'Când umbrele se sting şi ochii mei când plâng,
Atunci Isus e-al meu Prieten neclintit,
În rugăciune ia povara mea cea grea,
Când stau de vorbă cu Isus sunt fericit.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '012' and ss.source_title = 'Eram jos în păcat, dar Isus m-a salvat'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 6, 'Vino şi stai de vorbă azi cu Isus,
Vino, spune-l Lui ce griji te-apasă,
El să-ţi ia al tău suspin
Şi să-ţi dea pacea Sa din plin.
Când simţi că vrei să stai în rugăciune,
Când te arde-un dor şi nu-l poţi spune,
Numai pe genunchi lângă Isus eşti fericit.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '012' and ss.source_title = 'Eram jos în păcat, dar Isus m-a salvat'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Viaţă tinerească, plină de elan', 'Viaţă tinerească, plină de elan,
Frumuseţe, daruri, toate câte am,
Le închin de-a-ntregul pentru Dumnezeu.
De viaţa mea dispune Domnul meu.

Învăţător (este Isus),
Conducător (este Isus),
Eu nu cunosc (nici un altul)
Decât Isus Cristos (da, Isus).

Nu mă întineze duhul celui rău,
Să nu mă atragă jos din braţul Său.
Inima şi gândul să le umple dar
Pe deplin Isus Slăvitul cu-al Său har.

Învăţător (este Isus),
Conducător (este Isus),
Eu nu cunosc (nici un altul)
Decât Isus Cristos (da, Isus).

Cât de fericită viaţa mi-o trăiesc;
În Isus aflat-am totul ce doresc;
El mi-a dat iertare, mântuirea mea;
Prin credinţă, El mă duce-n slava Sa.

Învăţător (este Isus),
Conducător (este Isus),
Eu nu cunosc (nici un altul)
Decât Isus Cristos (da, Isus).', 'G', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '013 Viaţă tinerească, plină de elan .pptx', 'pptx', 'needs_review', 'Viaţă tinerească, plină de elan,
Frumuseţe, daruri, toate câte am,
Le închin de-a-ntregul pentru Dumnezeu.
De viaţa mea dispune Domnul meu.

Învăţător (este Isus),
Conducător (este Isus),
Eu nu cunosc (nici un altul)
Decât Isus Cristos (da, Isus).

Nu mă întineze duhul celui rău,
Să nu mă atragă jos din braţul Său.
Inima şi gândul să le umple dar
Pe deplin Isus Slăvitul cu-al Său har.

Învăţător (este Isus),
Conducător (este Isus),
Eu nu cunosc (nici un altul)
Decât Isus Cristos (da, Isus).

Cât de fericită viaţa mi-o trăiesc;
În Isus aflat-am totul ce doresc;
El mi-a dat iertare, mântuirea mea;
Prin credinţă, El mă duce-n slava Sa.

Învăţător (este Isus),
Conducător (este Isus),
Eu nu cunosc (nici un altul)
Decât Isus Cristos (da, Isus).', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '013', 'Viaţă tinerească, plină de elan', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Viaţă tinerească, plină de elan,
Frumuseţe, daruri, toate câte am,
Le închin de-a-ntregul pentru Dumnezeu.
De viaţa mea dispune Domnul meu.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '013' and ss.source_title = 'Viaţă tinerească, plină de elan'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'Învăţător (este Isus),
Conducător (este Isus),
Eu nu cunosc (nici un altul)
Decât Isus Cristos (da, Isus).'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '013' and ss.source_title = 'Viaţă tinerească, plină de elan'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Nu mă întineze duhul celui rău,
Să nu mă atragă jos din braţul Său.
Inima şi gândul să le umple dar
Pe deplin Isus Slăvitul cu-al Său har.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '013' and ss.source_title = 'Viaţă tinerească, plină de elan'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, 'Învăţător (este Isus),
Conducător (este Isus),
Eu nu cunosc (nici un altul)
Decât Isus Cristos (da, Isus).'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '013' and ss.source_title = 'Viaţă tinerească, plină de elan'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '3', 5, 'Cât de fericită viaţa mi-o trăiesc;
În Isus aflat-am totul ce doresc;
El mi-a dat iertare, mântuirea mea;
Prin credinţă, El mă duce-n slava Sa.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '013' and ss.source_title = 'Viaţă tinerească, plină de elan'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 6, 'Învăţător (este Isus),
Conducător (este Isus),
Eu nu cunosc (nici un altul)
Decât Isus Cristos (da, Isus).'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '013' and ss.source_title = 'Viaţă tinerească, plină de elan'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Ne-a arata raul vietii cel lin', '1. Ne-a arătat râul vieţii cel lin - A 014
Ne-a arătat râul vieţii cel lin,
Ca un cristal limpede şi curat.
El izvora chiar din Tronul divin,
Pe care Mielul era-ncoronat.

R. Ne-a arătat râul vieţii cel lin 014
/: Blesteme nu vor mai fi acolo,
Căci faţa-l sfântă va lumina.
De pace fi-va împărăţită
Şi dragostea Sa ne va lega.:/

2. Ne-a arătat râul vieţii cel lin 014
Noapte n-a fi, nici lumina de-aici,
Nici soarele nu va mai lumina,
Căci Dumnezeu însuşi va-mpărăţi
Şi-n strălucirea cea sfântă vom sta.

R. Ne-a arătat râul vieţii cel lin 014
/: Blesteme nu vor mai fi acolo,
Căci faţa-l sfântă va lumina.
De pace fi-va împărăţită
Şi dragostea Sa ne va lega.:/

3. Ne-a arătat râul vieţii cel lin 014
lată-n curând pe pământ va veni
Isus Hristos pentru a ne lua.
Ferice fi-va de cel ce-a citit
Cuvântul Sfânt şi apoi l-a-mplinit.

R. Ne-a arătat râul vieţii cel lin 014
/: Blesteme nu vor mai fi acolo,
Căci faţa-l sfântă va lumina.
De pace fi-va împărăţită
Şi dragostea Sa ne va lega.:/', 'A', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '014 Ne-a arata raul vietii cel lin.pptx', 'pptx', 'needs_review', '1. Ne-a arătat râul vieţii cel lin - A 014
Ne-a arătat râul vieţii cel lin,
Ca un cristal limpede şi curat.
El izvora chiar din Tronul divin,
Pe care Mielul era-ncoronat.

R. Ne-a arătat râul vieţii cel lin 014
/: Blesteme nu vor mai fi acolo,
Căci faţa-l sfântă va lumina.
De pace fi-va împărăţită
Şi dragostea Sa ne va lega.:/

2. Ne-a arătat râul vieţii cel lin 014
Noapte n-a fi, nici lumina de-aici,
Nici soarele nu va mai lumina,
Căci Dumnezeu însuşi va-mpărăţi
Şi-n strălucirea cea sfântă vom sta.

R. Ne-a arătat râul vieţii cel lin 014
/: Blesteme nu vor mai fi acolo,
Căci faţa-l sfântă va lumina.
De pace fi-va împărăţită
Şi dragostea Sa ne va lega.:/

3. Ne-a arătat râul vieţii cel lin 014
lată-n curând pe pământ va veni
Isus Hristos pentru a ne lua.
Ferice fi-va de cel ce-a citit
Cuvântul Sfânt şi apoi l-a-mplinit.

R. Ne-a arătat râul vieţii cel lin 014
/: Blesteme nu vor mai fi acolo,
Căci faţa-l sfântă va lumina.
De pace fi-va împărăţită
Şi dragostea Sa ne va lega.:/', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '014', 'Ne-a arata raul vietii cel lin', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, '1. Ne-a arătat râul vieţii cel lin - A 014
Ne-a arătat râul vieţii cel lin,
Ca un cristal limpede şi curat.
El izvora chiar din Tronul divin,
Pe care Mielul era-ncoronat.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '014' and ss.source_title = 'Ne-a arata raul vietii cel lin'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'R. Ne-a arătat râul vieţii cel lin 014
/: Blesteme nu vor mai fi acolo,
Căci faţa-l sfântă va lumina.
De pace fi-va împărăţită
Şi dragostea Sa ne va lega.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '014' and ss.source_title = 'Ne-a arata raul vietii cel lin'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, '2. Ne-a arătat râul vieţii cel lin 014
Noapte n-a fi, nici lumina de-aici,
Nici soarele nu va mai lumina,
Căci Dumnezeu însuşi va-mpărăţi
Şi-n strălucirea cea sfântă vom sta.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '014' and ss.source_title = 'Ne-a arata raul vietii cel lin'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, 'R. Ne-a arătat râul vieţii cel lin 014
/: Blesteme nu vor mai fi acolo,
Căci faţa-l sfântă va lumina.
De pace fi-va împărăţită
Şi dragostea Sa ne va lega.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '014' and ss.source_title = 'Ne-a arata raul vietii cel lin'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '3', 5, '3. Ne-a arătat râul vieţii cel lin 014
lată-n curând pe pământ va veni
Isus Hristos pentru a ne lua.
Ferice fi-va de cel ce-a citit
Cuvântul Sfânt şi apoi l-a-mplinit.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '014' and ss.source_title = 'Ne-a arata raul vietii cel lin'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 6, 'R. Ne-a arătat râul vieţii cel lin 014
/: Blesteme nu vor mai fi acolo,
Căci faţa-l sfântă va lumina.
De pace fi-va împărăţită
Şi dragostea Sa ne va lega.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '014' and ss.source_title = 'Ne-a arata raul vietii cel lin'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Nu este munte prea ''nalt', 'Nu este munte prea ''nalt să nu îl mişte,
Nu e problemă prea grea să n-o rezolve El.
Nu e furtună prea rea să n-o liniştească,
Nu e durere prea grea să n-o aline El.

/: El purtat-a pe umerii Săi povara lumii
Şi poate lua chiar acum povara ta:/

Nu este munte prea ''nalt să nu îl mişte,
Nu e problemă prea grea să n-o rezolve El.
Nu e furtună prea rea să n-o liniştească,
Nu e durere prea grea să n-o aline El.

/: El purtat-a pe umerii Săi povara lumii
Şi poate lua chiar acum povara ta.
Îndrăzneşte, prietene drag, Isus te cheamă
Inima să l-o deschizi, pacea să-ţi dea.:/
Inima să l-o deschizi, pacea să-ţi dea.', 'A', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '015 Nu este munte prea nalt.pptx', 'pptx', 'needs_review', 'Nu este munte prea ''nalt să nu îl mişte,
Nu e problemă prea grea să n-o rezolve El.
Nu e furtună prea rea să n-o liniştească,
Nu e durere prea grea să n-o aline El.

/: El purtat-a pe umerii Săi povara lumii
Şi poate lua chiar acum povara ta:/

Nu este munte prea ''nalt să nu îl mişte,
Nu e problemă prea grea să n-o rezolve El.
Nu e furtună prea rea să n-o liniştească,
Nu e durere prea grea să n-o aline El.

/: El purtat-a pe umerii Săi povara lumii
Şi poate lua chiar acum povara ta.
Îndrăzneşte, prietene drag, Isus te cheamă
Inima să l-o deschizi, pacea să-ţi dea.:/
Inima să l-o deschizi, pacea să-ţi dea.', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '015', 'Nu este munte prea ''nalt', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Nu este munte prea ''nalt să nu îl mişte,
Nu e problemă prea grea să n-o rezolve El.
Nu e furtună prea rea să n-o liniştească,
Nu e durere prea grea să n-o aline El.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '015' and ss.source_title = 'Nu este munte prea ''nalt'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, '/: El purtat-a pe umerii Săi povara lumii
Şi poate lua chiar acum povara ta:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '015' and ss.source_title = 'Nu este munte prea ''nalt'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Nu este munte prea ''nalt să nu îl mişte,
Nu e problemă prea grea să n-o rezolve El.
Nu e furtună prea rea să n-o liniştească,
Nu e durere prea grea să n-o aline El.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '015' and ss.source_title = 'Nu este munte prea ''nalt'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, '/: El purtat-a pe umerii Săi povara lumii
Şi poate lua chiar acum povara ta.
Îndrăzneşte, prietene drag, Isus te cheamă
Inima să l-o deschizi, pacea să-ţi dea.:/
Inima să l-o deschizi, pacea să-ţi dea.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '015' and ss.source_title = 'Nu este munte prea ''nalt'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('O, de-ai vrea sa vii la El', '1. O, de-ai vrea să vii Ia El - G 016
O, de-ai vrea să vii Ia El,
La Isus, Divinul Miel,
Viaţa ta se va schimba
După voia Sa.

R. O, de-ai vrea să vii Ia El 016
Te roagă Isus ca să vii, căci vrea fericit ca să fii.
Renunţă la ce-i păcătos şi să vii la Cristos.
Conştiinţa îţi cere să vii căci vrea fericit ca să fii,
De-ajuns cât ai tot neglijat
Şi ai stat atât de mult străin, azi auzi cântec divin,
Chiar Isus s-ar bucura de schimbarea ta.

2. O, de-ai vrea să vii Ia El 016
Azi auzi mesaj ceresc
De la cei ce te iubesc,
Cer şi toţi doresc în cor
Să fii frate-al lor.

R. O, de-ai vrea să vii Ia El 016
Te roagă Isus ca să vii, căci vrea fericit ca să fii.
Renunţă la ce-i păcătos şi să vii la Cristos.
Conştiinţa îţi cere să vii căci vrea fericit ca să fii,
De-ajuns cât ai tot neglijat
Şi ai stat atât de mult străin, azi auzi cântec divin,
Chiar Isus s-ar bucura de schimbarea ta.

3. O, de-ai vrea să vii Ia El 016
Nu conta pe mâine zi
Pentru a te pocăi,
Azi pe Isus de-L primeşti
Tu te mântuieşti.

R. O, de-ai vrea să vii Ia El 016
Te roagă Isus ca să vii, căci vrea fericit ca să fii.
Renunţă la ce-i păcătos şi să vii la Cristos.
Conştiinţa îţi cere să vii căci vrea fericit ca să fii,
De-ajuns cât ai tot neglijat
Şi ai stat atât de mult străin, azi auzi cântec divin,
Chiar Isus s-ar bucura de schimbarea ta.', 'G', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '016 O, de-ai vrea sa vii la El.pptx', 'pptx', 'needs_review', '1. O, de-ai vrea să vii Ia El - G 016
O, de-ai vrea să vii Ia El,
La Isus, Divinul Miel,
Viaţa ta se va schimba
După voia Sa.

R. O, de-ai vrea să vii Ia El 016
Te roagă Isus ca să vii, căci vrea fericit ca să fii.
Renunţă la ce-i păcătos şi să vii la Cristos.
Conştiinţa îţi cere să vii căci vrea fericit ca să fii,
De-ajuns cât ai tot neglijat
Şi ai stat atât de mult străin, azi auzi cântec divin,
Chiar Isus s-ar bucura de schimbarea ta.

2. O, de-ai vrea să vii Ia El 016
Azi auzi mesaj ceresc
De la cei ce te iubesc,
Cer şi toţi doresc în cor
Să fii frate-al lor.

R. O, de-ai vrea să vii Ia El 016
Te roagă Isus ca să vii, căci vrea fericit ca să fii.
Renunţă la ce-i păcătos şi să vii la Cristos.
Conştiinţa îţi cere să vii căci vrea fericit ca să fii,
De-ajuns cât ai tot neglijat
Şi ai stat atât de mult străin, azi auzi cântec divin,
Chiar Isus s-ar bucura de schimbarea ta.

3. O, de-ai vrea să vii Ia El 016
Nu conta pe mâine zi
Pentru a te pocăi,
Azi pe Isus de-L primeşti
Tu te mântuieşti.

R. O, de-ai vrea să vii Ia El 016
Te roagă Isus ca să vii, căci vrea fericit ca să fii.
Renunţă la ce-i păcătos şi să vii la Cristos.
Conştiinţa îţi cere să vii căci vrea fericit ca să fii,
De-ajuns cât ai tot neglijat
Şi ai stat atât de mult străin, azi auzi cântec divin,
Chiar Isus s-ar bucura de schimbarea ta.', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '016', 'O, de-ai vrea sa vii la El', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, '1. O, de-ai vrea să vii Ia El - G 016
O, de-ai vrea să vii Ia El,
La Isus, Divinul Miel,
Viaţa ta se va schimba
După voia Sa.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '016' and ss.source_title = 'O, de-ai vrea sa vii la El'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'R. O, de-ai vrea să vii Ia El 016
Te roagă Isus ca să vii, căci vrea fericit ca să fii.
Renunţă la ce-i păcătos şi să vii la Cristos.
Conştiinţa îţi cere să vii căci vrea fericit ca să fii,
De-ajuns cât ai tot neglijat
Şi ai stat atât de mult străin, azi auzi cântec divin,
Chiar Isus s-ar bucura de schimbarea ta.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '016' and ss.source_title = 'O, de-ai vrea sa vii la El'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, '2. O, de-ai vrea să vii Ia El 016
Azi auzi mesaj ceresc
De la cei ce te iubesc,
Cer şi toţi doresc în cor
Să fii frate-al lor.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '016' and ss.source_title = 'O, de-ai vrea sa vii la El'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, 'R. O, de-ai vrea să vii Ia El 016
Te roagă Isus ca să vii, căci vrea fericit ca să fii.
Renunţă la ce-i păcătos şi să vii la Cristos.
Conştiinţa îţi cere să vii căci vrea fericit ca să fii,
De-ajuns cât ai tot neglijat
Şi ai stat atât de mult străin, azi auzi cântec divin,
Chiar Isus s-ar bucura de schimbarea ta.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '016' and ss.source_title = 'O, de-ai vrea sa vii la El'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '3', 5, '3. O, de-ai vrea să vii Ia El 016
Nu conta pe mâine zi
Pentru a te pocăi,
Azi pe Isus de-L primeşti
Tu te mântuieşti.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '016' and ss.source_title = 'O, de-ai vrea sa vii la El'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 6, 'R. O, de-ai vrea să vii Ia El 016
Te roagă Isus ca să vii, căci vrea fericit ca să fii.
Renunţă la ce-i păcătos şi să vii la Cristos.
Conştiinţa îţi cere să vii căci vrea fericit ca să fii,
De-ajuns cât ai tot neglijat
Şi ai stat atât de mult străin, azi auzi cântec divin,
Chiar Isus s-ar bucura de schimbarea ta.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '016' and ss.source_title = 'O, de-ai vrea sa vii la El'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Pe Isus L-am primit când m-a chemat', 'Pe Isus L-am primit când m-a chemat,
Păcatul mi-a luat, păcatul mi-a luat,
Şi pacea Lui îndată El mi-a dat
Păcatul mi-a luat.

/: Păcatul mi-a luat, păcatul mi-a luat,
De-aceea-l cânt neîncetat: ALELUIA!
Pe Isus L-am primit când m-a chemat,
Păcatul mi-a luat.:/

De-ai să-L primeşti azi pe Isus Hristos
Păcatu-ţi va lua, păcatu-ţi va lua,
Şi fericit vei merge bucuros,
Păcatu-ţi va lua.

/: Păcatul mi-a luat, păcatul mi-a luat,
De-aceea-l cânt neîncetat: ALELUIA!
Pe Isus L-am primit când m-a chemat,
Păcatul mi-a luat.:/', 'G', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '017 Pe Isus L-am primit cand m-a chemat.pptx', 'pptx', 'needs_review', 'Pe Isus L-am primit când m-a chemat,
Păcatul mi-a luat, păcatul mi-a luat,
Şi pacea Lui îndată El mi-a dat
Păcatul mi-a luat.

/: Păcatul mi-a luat, păcatul mi-a luat,
De-aceea-l cânt neîncetat: ALELUIA!
Pe Isus L-am primit când m-a chemat,
Păcatul mi-a luat.:/

De-ai să-L primeşti azi pe Isus Hristos
Păcatu-ţi va lua, păcatu-ţi va lua,
Şi fericit vei merge bucuros,
Păcatu-ţi va lua.

/: Păcatul mi-a luat, păcatul mi-a luat,
De-aceea-l cânt neîncetat: ALELUIA!
Pe Isus L-am primit când m-a chemat,
Păcatul mi-a luat.:/', 'Unele sectiuni par repetate; verifica daca refrenul trebuie pastrat o singura data sau in structura completa.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '017', 'Pe Isus L-am primit când m-a chemat', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Pe Isus L-am primit când m-a chemat,
Păcatul mi-a luat, păcatul mi-a luat,
Şi pacea Lui îndată El mi-a dat
Păcatul mi-a luat.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '017' and ss.source_title = 'Pe Isus L-am primit când m-a chemat'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, '/: Păcatul mi-a luat, păcatul mi-a luat,
De-aceea-l cânt neîncetat: ALELUIA!
Pe Isus L-am primit când m-a chemat,
Păcatul mi-a luat.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '017' and ss.source_title = 'Pe Isus L-am primit când m-a chemat'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'De-ai să-L primeşti azi pe Isus Hristos
Păcatu-ţi va lua, păcatu-ţi va lua,
Şi fericit vei merge bucuros,
Păcatu-ţi va lua.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '017' and ss.source_title = 'Pe Isus L-am primit când m-a chemat'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, '/: Păcatul mi-a luat, păcatul mi-a luat,
De-aceea-l cânt neîncetat: ALELUIA!
Pe Isus L-am primit când m-a chemat,
Păcatul mi-a luat.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '017' and ss.source_title = 'Pe Isus L-am primit când m-a chemat'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Pentru tine-un păcătos – a', 'Pentru tine-un păcătos,
Pentru mine-un ticălos,
Pentru noi, iubite suflet,
A murit Isus Hristos.
A murit pe lemnul crucii,
Ca noi doi să fim salvaţi
De-ale noastre mari păcate.

Este greu, da, este greu
Să trăieşti făr’ Dumnezeu.
Dar, te rog, nu te uita
La viaţa ta cea grea.
Uită-te doar la Isus
Ce la cruce El s-a dus
Ca să moară pentru tine.

Deci, acum când tu doreşti
Pe Isus ca să-L primeşti
Tu în dragoste să stai,
Ca în lume să nu te pierzi.
Şi-ntr-o veşnică iubire,
Cu Isus ca să rămâi
Doar o lumină vie.

/:Este greu, da, este greu
Să trăieşti făr’ Dumnezeu.
Dar, te rog, nu te uita
La viaţa ta cea grea.
Uită-te doar la Isus
Ce la cruce El s-a dus
Ca să moară pentru tine.:/', null, 'Import automat din PPTX; necesita verificare manuala.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '018 Pentru tine, un pacatos.pptx', 'pptx', 'needs_review', 'Pentru tine-un păcătos,
Pentru mine-un ticălos,
Pentru noi, iubite suflet,
A murit Isus Hristos.
A murit pe lemnul crucii,
Ca noi doi să fim salvaţi
De-ale noastre mari păcate.

Este greu, da, este greu
Să trăieşti făr’ Dumnezeu.
Dar, te rog, nu te uita
La viaţa ta cea grea.
Uită-te doar la Isus
Ce la cruce El s-a dus
Ca să moară pentru tine.

Deci, acum când tu doreşti
Pe Isus ca să-L primeşti
Tu în dragoste să stai,
Ca în lume să nu te pierzi.
Şi-ntr-o veşnică iubire,
Cu Isus ca să rămâi
Doar o lumină vie.

/:Este greu, da, este greu
Să trăieşti făr’ Dumnezeu.
Dar, te rog, nu te uita
La viaţa ta cea grea.
Uită-te doar la Isus
Ce la cruce El s-a dus
Ca să moară pentru tine.:/', 'Import automat din PPTX; necesita verificare manuala.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '018', 'Pentru tine-un păcătos – a', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Pentru tine-un păcătos,
Pentru mine-un ticălos,
Pentru noi, iubite suflet,
A murit Isus Hristos.
A murit pe lemnul crucii,
Ca noi doi să fim salvaţi
De-ale noastre mari păcate.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '018' and ss.source_title = 'Pentru tine-un păcătos – a'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'Este greu, da, este greu
Să trăieşti făr’ Dumnezeu.
Dar, te rog, nu te uita
La viaţa ta cea grea.
Uită-te doar la Isus
Ce la cruce El s-a dus
Ca să moară pentru tine.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '018' and ss.source_title = 'Pentru tine-un păcătos – a'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Deci, acum când tu doreşti
Pe Isus ca să-L primeşti
Tu în dragoste să stai,
Ca în lume să nu te pierzi.
Şi-ntr-o veşnică iubire,
Cu Isus ca să rămâi
Doar o lumină vie.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '018' and ss.source_title = 'Pentru tine-un păcătos – a'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, '/:Este greu, da, este greu
Să trăieşti făr’ Dumnezeu.
Dar, te rog, nu te uita
La viaţa ta cea grea.
Uită-te doar la Isus
Ce la cruce El s-a dus
Ca să moară pentru tine.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '018' and ss.source_title = 'Pentru tine-un păcătos – a'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Pleacă-ţi genunchii, Isus e aici', 'Pleacă-ţi genunchii, Isus e aici,
Ridică mâini curate spre cer,
Tronul de mărire e-n faţa ta,
Slava se coboară din cer.
Îndrăzneşte de intră în Locul Sfânt,
Spălat în sângele Mielului,
Vino cu cântări de mărire,
Osana Mielului Preasfânt.

Rege-al regilor,
Domn al Domnilor,
Isus, Isus.

Vino cu povara din viaţa ta,
Durerea ce te-apasă mereu,
Mâna lui Isus poate vindeca
Durerea şi păcatul cel greu.
Slava ce coboară din cerul sfânt,
Dragostea şi roadele ei,
Înţelepciunea şi credinţa de neclintit,
Totul poţi avea, doar să vrei.

/:Rege-al regilor,
Domn al Domnilor,
/:Isus, Isus.:/ X2', 'C', 'Import automat din PPTX; necesita verificare manuala.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '019 Pleaca-ti genunchii, Isus e aici.pptx', 'pptx', 'needs_review', 'Pleacă-ţi genunchii, Isus e aici,
Ridică mâini curate spre cer,
Tronul de mărire e-n faţa ta,
Slava se coboară din cer.
Îndrăzneşte de intră în Locul Sfânt,
Spălat în sângele Mielului,
Vino cu cântări de mărire,
Osana Mielului Preasfânt.

Rege-al regilor,
Domn al Domnilor,
Isus, Isus.

Vino cu povara din viaţa ta,
Durerea ce te-apasă mereu,
Mâna lui Isus poate vindeca
Durerea şi păcatul cel greu.
Slava ce coboară din cerul sfânt,
Dragostea şi roadele ei,
Înţelepciunea şi credinţa de neclintit,
Totul poţi avea, doar să vrei.

/:Rege-al regilor,
Domn al Domnilor,
/:Isus, Isus.:/ X2', 'Import automat din PPTX; necesita verificare manuala.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '019', 'Pleacă-ţi genunchii, Isus e aici', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Pleacă-ţi genunchii, Isus e aici,
Ridică mâini curate spre cer,
Tronul de mărire e-n faţa ta,
Slava se coboară din cer.
Îndrăzneşte de intră în Locul Sfânt,
Spălat în sângele Mielului,
Vino cu cântări de mărire,
Osana Mielului Preasfânt.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '019' and ss.source_title = 'Pleacă-ţi genunchii, Isus e aici'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'Rege-al regilor,
Domn al Domnilor,
Isus, Isus.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '019' and ss.source_title = 'Pleacă-ţi genunchii, Isus e aici'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Vino cu povara din viaţa ta,
Durerea ce te-apasă mereu,
Mâna lui Isus poate vindeca
Durerea şi păcatul cel greu.
Slava ce coboară din cerul sfânt,
Dragostea şi roadele ei,
Înţelepciunea şi credinţa de neclintit,
Totul poţi avea, doar să vrei.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '019' and ss.source_title = 'Pleacă-ţi genunchii, Isus e aici'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, '/:Rege-al regilor,
Domn al Domnilor,
/:Isus, Isus.:/ X2'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '019' and ss.source_title = 'Pleacă-ţi genunchii, Isus e aici'
order by s.created_at desc
limit 1;

with collection as (
  select id from public.song_collections where short_code = 'TINERI'
), inserted_song as (
  insert into public.songs (title, lyrics_text, default_key, notes)
  values ('Domn peste pământ', 'Domn peste pământ,
Peste Univers şi peste noi,
Eşti Dumnezeu şi Creator
Al nostru Domn.

Suntem ai Tăi,
Copii pentru vecii,
Azi Te rugăm prin Duhul Tău
Luminează peste noi.

Prin lumina Ta
Vrem mereu să stăm pe calea Ta,
Duh din Duhul Tău
Revarsă azi peste noi.

Privind în noi
Găsim iubirea Ta
Ne-ai mântuit, ne-ai fericit
Să fii veşnic preamărit.

Suntem ai Tăi,
Copii pentru vecii,
Azi Te rugăm prin Duhul Tău
/: Luminează peste noi.:/', 'C', 'Import automat din PPTX; necesita verificare manuala.')
  returning id
), inserted_file as (
  insert into public.song_files (collection_id, song_id, file_name, file_type, import_status, parsed_text, parser_notes)
  select collection.id, inserted_song.id, '020 Domn peste pamant.pptx', 'pptx', 'needs_review', 'Domn peste pământ,
Peste Univers şi peste noi,
Eşti Dumnezeu şi Creator
Al nostru Domn.

Suntem ai Tăi,
Copii pentru vecii,
Azi Te rugăm prin Duhul Tău
Luminează peste noi.

Prin lumina Ta
Vrem mereu să stăm pe calea Ta,
Duh din Duhul Tău
Revarsă azi peste noi.

Privind în noi
Găsim iubirea Ta
Ne-ai mântuit, ne-ai fericit
Să fii veşnic preamărit.

Suntem ai Tăi,
Copii pentru vecii,
Azi Te rugăm prin Duhul Tău
/: Luminează peste noi.:/', 'Import automat din PPTX; necesita verificare manuala.'
  from collection, inserted_song
  returning id, song_id
)
insert into public.song_sources (song_id, collection_id, song_number, source_title, source_file_id)
select inserted_song.id, collection.id, '020', 'Domn peste pământ', inserted_file.id
from inserted_song, collection, inserted_file;

insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '1', 1, 'Domn peste pământ,
Peste Univers şi peste noi,
Eşti Dumnezeu şi Creator
Al nostru Domn.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '020' and ss.source_title = 'Domn peste pământ'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 2, 'Suntem ai Tăi,
Copii pentru vecii,
Azi Te rugăm prin Duhul Tău
Luminează peste noi.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '020' and ss.source_title = 'Domn peste pământ'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'verse', '2', 3, 'Prin lumina Ta
Vrem mereu să stăm pe calea Ta,
Duh din Duhul Tău
Revarsă azi peste noi.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '020' and ss.source_title = 'Domn peste pământ'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 4, 'Privind în noi
Găsim iubirea Ta
Ne-ai mântuit, ne-ai fericit
Să fii veşnic preamărit.'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '020' and ss.source_title = 'Domn peste pământ'
order by s.created_at desc
limit 1;
insert into public.song_sections (song_id, section_type, section_label, position, content)
select s.id, 'chorus', 'R', 5, 'Suntem ai Tăi,
Copii pentru vecii,
Azi Te rugăm prin Duhul Tău
/: Luminează peste noi.:/'
from public.songs s
join public.song_sources ss on ss.song_id = s.id
join public.song_collections c on c.id = ss.collection_id and c.short_code = 'TINERI'
where ss.song_number is not distinct from '020' and ss.source_title = 'Domn peste pământ'
order by s.created_at desc
limit 1;

