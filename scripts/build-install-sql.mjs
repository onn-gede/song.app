import fs from 'node:fs';
import path from 'node:path';
const dir=path.join(process.cwd(),'supabase','migrations');
fs.mkdirSync('supabase/setup',{recursive:true});
fs.mkdirSync('supabase/updates',{recursive:true});
const migrations=fs.readdirSync(dir).filter(file=>/^\d+.*\.sql$/.test(file)&&!file.startsWith('003_')).sort();
const read=file=>fs.readFileSync(path.join(dir,file),'utf8');
fs.writeFileSync('supabase/setup/INSTALL-NEW.sql','-- INSTALARE NOUĂ, NUMAI PE O BAZĂ FĂRĂ SONGAPP.\n-- Nu include utilizatori, date demonstrative sau importul Bibliei.\n\n'+migrations.map(file=>`\n-- FILE: ${file}\n${read(file)}`).join('\n'));
const update=['035_v41_1_full_bible_library_fixed.sql','036_v42_stabilization.sql'];
fs.writeFileSync('supabase/updates/UPDATE-V42.sql',`-- ACTUALIZARE pentru o bază SongApp cu migrările până la 034 aplicate.\n-- Creează mai întâi un backup. Nu rulează resetări și nu importă cântări.\nbegin;\ndo $$ begin
  if to_regclass('public.public_meeting_contributions') is null or to_regprocedure('public.upsert_external_song_title_lyrics(uuid,uuid,text,text,text,text,jsonb,text,boolean)') is null then
    raise exception 'Baza existentă nu are toate migrările anterioare. Oprește actualizarea și verifică instalarea.';
  end if;
end $$;\n`+update.map(file=>`\n-- FILE: ${file}\n${read(file).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'')}`).join('\n')+'\ncommit;\n');


fs.writeFileSync('supabase/updates/UPDATE-V43.sql','-- ACTUALIZARE v42 → v43, pe ACELAȘI proiect Supabase. Nu este instalare nouă.\n'+read('037_v43_link_import.sql'));


fs.writeFileSync('supabase/updates/UPDATE-V44.sql','-- ACTUALIZARE v43/v43.1 → v44, pe baza existentă. Nu este instalare nouă.\n'+read('038_v44_library_search.sql'));


fs.writeFileSync('supabase/updates/UPDATE-V45.sql','-- ACTUALIZARE v44 → v45 pe ACELAȘI proiect Supabase. Păstrează datele existente.\n'+read('039_v45_program_fixes.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V46.sql','-- ACTUALIZARE v45 → v46 pe ACELAȘI proiect Supabase.\n'+read('040_v46_usage_and_live_program.sql')+'\n'+read('041_v46_youth_keys.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V47.sql','-- ACTUALIZARE v45/v46 → v47 pe ACELAȘI proiect Supabase. Include dependențele și raportul gamelor din v46.\n'+read('040_v46_usage_and_live_program.sql')+'\n'+read('041_v46_youth_keys.sql')+'\n'+read('042_v47_workflows.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V48.sql','-- ACTUALIZARE v47/v47.1 → v48 pe ACELAȘI proiect Supabase.\n'+read('043_v48_access_audit.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V49.sql','-- ACTUALIZARE v48 → v49 pe ACELAȘI proiect Supabase.\n'+read('044_v49_program_creation_search.sql'));

console.log('SQL pregătit în supabase/setup și supabase/updates. Nu s-a executat SQL pe bază.');

fs.writeFileSync('supabase/updates/UPDATE-V52.sql','-- ACTUALIZARE v51 / bază v49 → v52 pe ACELAȘI proiect Supabase.\n'+read('045_v52_collections_planning.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V53.sql','-- ACTUALIZARE v52 → v53 pe ACELAȘI proiect Supabase. Păstrează datele existente.\n'+read('046_v53_program_ui.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V54.sql','-- ACTUALIZARE v53 → v54, pe aceeași bază Supabase.\n'+read('047_v54_program_notifications.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V55.sql','-- ACTUALIZARE v54 → v55: import local Carte roșie. Nu importă date automat.\n'+read('048_v55_red_book_import.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V56.sql','-- ACTUALIZARE v55 → v56 pe baza existentă.\n'+read('049_v56_library_activity.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V57.sql','-- ACTUALIZARE după v56, pe aceeași bază.\n'+read('050_v57_search_add_ui.sql')+'\n'+read('051_v57_books_repair.sql'));
fs.writeFileSync('supabase/updates/UPDATE-V57-1-SAFE-IMPORT.sql',read('052_v57_1_safe_import.sql'));
fs.writeFileSync('supabase/updates/UPDATE-V58.sql','-- Actualizare după v57 sau v57.1, în aceeași bază. Nu importă și nu arhivează cântări.\n'+read('052_v57_1_safe_import.sql')+'\n'+read('053_v58_presentation_import.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V59.sql','-- După v58, în aceeași bază.\n'+read('054_v59_public_moment_types.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V62.sql','-- După v59/v61, în aceeași bază.\n'+read('055_v62_program_details.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V63.sql','-- După v62, în aceeași bază.\n'+read('056_v63_current_usage.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V64.sql','-- După v63, pe aceeași bază.\n'+read('057_v64_backup.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V65.sql','-- După v64, pe aceeași bază. Nu repară automat versurile.\n'+read('058_v65_program_polish.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V66.sql','-- După v65, pe aceeași bază. Nu modifică utilizatori sau sesiuni în bază.\n'+read('059_v66_welcome.sql'));

fs.writeFileSync('supabase/updates/UPDATE-V67.sql','-- După v66, pe aceeași bază. Limitează doar lista publică de la intrare, nu șterge programe.\n'+read('060_v67_welcome_selection.sql'));
