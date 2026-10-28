import fs from 'node:fs';
import path from 'node:path';
const dir=path.join(process.cwd(),'supabase');
const migrations=fs.readdirSync(dir).filter(file=>/^\d+.*\.sql$/.test(file)&&!file.startsWith('003_')).sort();
const read=file=>fs.readFileSync(path.join(dir,file),'utf8');
fs.writeFileSync('INSTALL-NEW.sql','-- INSTALARE NOUĂ, NUMAI PE O BAZĂ FĂRĂ SONGAPP.\n-- Nu include utilizatori, date demonstrative sau importul Bibliei.\n\n'+migrations.map(file=>`\n-- FILE: ${file}\n${read(file)}`).join('\n'));
const update=['035_v41_1_full_bible_library_fixed.sql','036_v42_stabilization.sql'];
fs.writeFileSync('UPDATE-V42.sql',`-- ACTUALIZARE pentru o bază SongApp cu migrările până la 034 aplicate.\n-- Creează mai întâi un backup. Nu rulează resetări și nu importă cântări.\nbegin;\ndo $$ begin
  if to_regclass('public.public_meeting_contributions') is null or to_regprocedure('public.upsert_external_song_title_lyrics(uuid,uuid,text,text,text,text,jsonb,text,boolean)') is null then
    raise exception 'Baza existentă nu are toate migrările anterioare. Oprește actualizarea și verifică instalarea.';
  end if;
end $$;\n`+update.map(file=>`\n-- FILE: ${file}\n${read(file).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'')}`).join('\n')+'\ncommit;\n');
console.log('Generated UPDATE-V42.sql and INSTALL-NEW.sql');

fs.writeFileSync('UPDATE-V43.sql','-- ACTUALIZARE v42 → v43, pe ACELAȘI proiect Supabase. Nu este instalare nouă.\n'+read('037_v43_link_import.sql'));
console.log('Generated UPDATE-V43.sql');

fs.writeFileSync('UPDATE-V44.sql','-- ACTUALIZARE v43/v43.1 → v44, pe baza existentă. Nu este instalare nouă.\n'+read('038_v44_library_search.sql'));
console.log('Generated UPDATE-V44.sql');

fs.writeFileSync('UPDATE-V45.sql','-- ACTUALIZARE v44 → v45 pe ACELAȘI proiect Supabase. Păstrează datele existente.\n'+read('039_v45_program_fixes.sql'));

fs.writeFileSync('UPDATE-V46.sql','-- ACTUALIZARE v45 → v46 pe ACELAȘI proiect Supabase.\n'+read('040_v46_usage_and_live_program.sql')+'\n'+read('041_v46_youth_keys.sql'));

fs.writeFileSync('UPDATE-V47.sql','-- ACTUALIZARE v45/v46 → v47 pe ACELAȘI proiect Supabase. Include dependențele și raportul gamelor din v46.\n'+read('040_v46_usage_and_live_program.sql')+'\n'+read('041_v46_youth_keys.sql')+'\n'+read('042_v47_workflows.sql'));

fs.writeFileSync('UPDATE-V48.sql','-- ACTUALIZARE v47/v47.1 → v48 pe ACELAȘI proiect Supabase.\n'+read('043_v48_access_audit.sql'));

fs.writeFileSync('UPDATE-V49.sql','-- ACTUALIZARE v48 → v49 pe ACELAȘI proiect Supabase.\n'+read('044_v49_program_creation_search.sql'));
