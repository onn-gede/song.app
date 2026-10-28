import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ADMIN='00000000-0000-0000-0000-000000000001';
const VIEWER='00000000-0000-0000-0000-000000000002';
const INACTIVE='00000000-0000-0000-0000-000000000003';

test("migrations, RLS, library pagination, duplicate and durable queue", async (t) => {
  const [{ pg_trgm }, { unaccent }, { pgcrypto }] = await Promise.all([
    import("@electric-sql/pglite/contrib/pg_trgm"), import("@electric-sql/pglite/contrib/unaccent"), import("@electric-sql/pglite/contrib/pgcrypto")
  ]);
  const db = new PGlite({ extensions: { pg_trgm, unaccent, pgcrypto } });
  const scalar = async (sql: string, args: unknown[] = []) => Object.values((await db.query<Record<string, any>>(sql,args)).rows[0])[0];
  const asUser = async (id: string, role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[id,role]);
    await db.exec(`set role ${role}`);
  };
  try {
    const setup = `
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      grant usage on schema public,auth,storage to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key,bucket_id text,name text);
      alter table storage.objects enable row level security;
    `;
    await db.exec(setup);
    const dir=path.join(process.cwd(),'supabase');
    for(const file of fs.readdirSync(dir).filter((f)=>f.endsWith('.sql')).sort()) {
      if(file.startsWith('003_')||file==='035_v41_full_bible_library.sql')continue;
      try { await db.exec(fs.readFileSync(path.join(dir,file),'utf8')); }
      catch(error) { throw new Error(`Migration ${file}: ${(error as Error).message}`); }
    }
    await db.exec(`insert into auth.users(id) values('${ADMIN}'),('${VIEWER}'),('${INACTIVE}');
      insert into public.profiles(id,email,role,is_active) values
      ('${ADMIN}','admin@example.org','admin',true),('${VIEWER}','viewer@example.org','viewer',true),('${INACTIVE}','inactive@example.org','editor',false) on conflict(id) do update set email=excluded.email,role=excluded.role,is_active=excluded.is_active;
      insert into public.songs(title,lyrics_text) select 'Song '||lpad(i::text,5,'0'),'Prima linie de versuri' from generate_series(1,5205) i;
    `);
    await t.test('stable pages beyond 50 and DB filters',async()=>{
      await asUser(ADMIN);
      const page1=await scalar('select public.list_song_library(p_page=>1)');
      const page2=await scalar('select public.list_song_library(p_page=>2)');
      assert.equal(page1.total,5205);assert.equal(page1.songs.length,50);assert.equal(page2.songs.length,50);
      assert.equal(new Set([...page1.songs,...page2.songs].map((s:any)=>s.id)).size,100);
      assert.equal((await scalar('select public.list_song_library(p_page=>105)')).songs.length,5);
      assert.equal((await scalar("select public.list_song_library(p_key=>'F#')")).total,0);
    });
    await t.test('v44 search combines with filters and retains pagination accuracy',async()=>{
      await asUser(ADMIN);
      const match=await scalar("select public.list_song_library_v44(p_query=>'Song 00001')");
      assert.equal(match.total,1);assert.equal(match.songs[0].title,'Song 00001');
      assert.equal((await scalar("select public.list_song_library_v44(p_query=>'Song 00001',p_key=>'F#')")).total,0);
      const target=match.songs[0].id;
      await db.query("update public.songs set lyrics_text='Încredere și mulțumire' where id=$1",[target]);
      assert.equal((await scalar("select public.list_song_library_v44(p_query=>'incredere')")).total,1);
      const collection=await scalar("select id from public.song_collections order by name limit 1");
      await db.query("insert into public.song_sources(song_id,collection_id,song_number,source_title) values($1,$2,'777X','Song 00001')",[target,collection]);
      assert.equal((await scalar("select public.list_song_library_v44(p_query=>'777X',p_collection=>$1)",[collection])).total,1);

      const page2=await scalar("select public.list_song_library_v44(p_query=>'Song',p_page=>2)");assert.equal(page2.songs.length,50);assert.equal(page2.total,5205);
      await asUser(INACTIVE);assert.equal((await scalar("select public.list_song_library_v44(p_query=>'Song')")).total,0);
      await asUser('','anon');await assert.rejects(()=>db.query("select public.list_song_library_v44()"));await asUser(ADMIN);
    });
    await t.test('inactive account cannot read directly or through read RPC',async()=>{
      await asUser(INACTIVE);
      assert.equal(await scalar('select count(*) from public.songs'),0);
      assert.equal((await scalar('select public.list_song_library()')).total,0);
      assert.equal(await scalar("select count(*) from public.search_songs('Song',25)"),0);
      await assert.rejects(()=>db.query("select public.enqueue_external_sync(1,25,false)"));
    });
    let meeting: string;
    let song: string;
    await t.test('viewer reads but cannot mutate; anonymous internal RPC denied',async()=>{
      await asUser(VIEWER);
      assert.equal(await scalar('select count(*) from public.songs'),5205);
      await assert.rejects(()=>db.query("select public.create_meeting('forbidden',null,now(),null)"));
      await asUser('', 'anon');
      await assert.rejects(()=>db.query("select * from public.search_songs('Song',25)"));
      assert.equal(await scalar("select public.get_shared_meeting('invalid')"),null);
    });
    await t.test('duplicate copies items atomically without public links/contributions',async()=>{
      await asUser(ADMIN);
      meeting=await scalar("select public.create_meeting('Original',null,now(),null)");
      song=await scalar('select id from public.songs order by title limit 1');
      await db.query('select public.add_song_to_meeting($1,$2,false,null,null)',[meeting,song]);
      await db.query("select public.add_text_to_meeting($1,'prayer','Rugăciune','Text')",[meeting]);
      const copy=await scalar("select public.duplicate_meeting($1,'Copy',now()+interval '7 days')",[meeting]);
      assert.notEqual(copy,meeting);
      assert.equal(await scalar('select count(*) from public.meeting_items where meeting_id=$1',[copy]),2);
      assert.equal(await scalar('select count(*) from public.meeting_share_links where meeting_id=$1',[copy]),0);
      await assert.rejects(()=>db.query("select public.duplicate_meeting($1,'',now())",[meeting]));
      assert.equal(await scalar('select count(*) from public.meetings'),2);
    });
    await t.test('templates excluded from usage; responsible copied and shown through public link',async()=>{
      await asUser(ADMIN);
      await db.query("update public.meetings set is_template=true where id=$1",[meeting]);
      await db.query("update public.meeting_items set responsible_name='Filip' where meeting_id=$1",[meeting]);
      assert.equal(await scalar('select count(*) from public.get_song_recent_usage()'),0); // other copy is in the future
      const copy=await scalar("select public.duplicate_meeting($1,'From template',now())",[meeting]);
      assert.equal(await scalar('select is_template from public.meetings where id=$1',[copy]),false);
      assert.equal(await scalar('select count(*) from public.meeting_items where meeting_id=$1 and responsible_name=\'Filip\'',[copy]),2);
      const slug=await scalar("select public.create_meeting_share_link($1,'test-public')",[copy]);
      await db.query('update public.meeting_share_links set allow_contributions=true where meeting_id=$1',[copy]);
      await asUser('','anon');
      const shared=await scalar("select public.get_shared_meeting($1)",[slug]);
      assert.equal(shared.items[0].responsible_name,'Filip');
      assert.ok((await db.query("select * from public.public_search_songs_for_share($1,'Song',10)",[slug])).rows.length>0);
      await asUser(ADMIN);await db.query("update public.meeting_share_links set expires_at=now()-interval '1 minute' where meeting_id=$1",[copy]);
      await asUser('','anon');assert.equal(await scalar("select public.get_shared_meeting($1)",[slug]),null);
      assert.equal((await db.query("select * from public.public_search_songs_for_share($1,'Song',10)",[slug])).rows.length,0);
      await asUser(ADMIN);
    });
    await t.test('v45 repeated adds, moves both ways, arrows and atomic invalid moves', async () => {
      await asUser(ADMIN);
      const id=await scalar("select public.create_meeting('Movement regression',null,now(),null)");
      const first=await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[id,song]);
      const second=await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[id,song]);
      const backup=await scalar('select public.add_song_to_meeting($1,$2,true,null,null)',[id,song]);
      const rows=async()=> (await db.query<{id:string;is_backup:boolean;position:number}>('select id,is_backup,position from public.meeting_items where meeting_id=$1 order by position',[id])).rows;
      assert.equal((await rows()).length,3);
      // up / insert before, then down / append: the same endpoint as UI controls.
      await db.query('select public.place_meeting_item_v45($1,$2,false,$3)',[id,second,first]);
      assert.deepEqual((await rows()).filter(r=>!r.is_backup).map(r=>r.id),[second,first]);
      await db.query('select public.place_meeting_item_v45($1,$2,false,null)',[id,second]);
      assert.deepEqual((await rows()).filter(r=>!r.is_backup).map(r=>r.id),[first,second]);
      await db.query('select public.place_meeting_item_v45($1,$2,false,$3)',[id,backup,second]);
      assert.deepEqual((await rows()).filter(r=>!r.is_backup).map(r=>r.id),[first,backup,second]);
      await db.query('select public.place_meeting_item_v45($1,$2,true,null)',[id,first]);
      await db.query('select public.place_meeting_item_v45($1,$2,true,$3)',[id,second,first]);
      assert.deepEqual((await rows()).filter(r=>r.is_backup).map(r=>r.id),[second,first]);
      const before=await rows();
      await assert.rejects(()=>db.query('select public.place_meeting_item_v45($1,$2,false,$3)',[id,backup,first]));
      assert.deepEqual(await rows(),before);
      // A new song and moment after transfer must not collide with any existing position.
      await db.query('select public.add_song_to_meeting($1,$2,true,null,null)',[id,song]);
      await db.query("select public.add_text_to_meeting($1,'prayer','Rugăciune','Text')",[id]);
      assert.equal((await rows()).length,5);
      await asUser(VIEWER);await assert.rejects(()=>db.query('select public.place_meeting_item_v45($1,$2,false,null)',[id,first]));
      await asUser(INACTIVE);await assert.rejects(()=>db.query('select public.place_meeting_item_v45($1,$2,false,null)',[id,first]));
      await asUser('','anon');await assert.rejects(()=>db.query('select public.place_meeting_item_v45($1,$2,false,null)',[id,first]));
      await asUser(ADMIN);
    });
    await t.test('v45 program responsibles preserved by duplication and public print data', async () => {
      await asUser(ADMIN);
      await db.query("update public.meetings set principal_responsible='Filip',secondary_responsibles=array['Ana','Ștefan'] where id=$1",[meeting]);
      const copy=await scalar("select public.duplicate_meeting($1,'Team copy',now())",[meeting]);
      const team=(await db.query<any>('select principal_responsible,secondary_responsibles from public.meetings where id=$1',[copy])).rows[0];
      assert.equal(team.principal_responsible,'Filip');assert.deepEqual(team.secondary_responsibles,['Ana','Ștefan']);
      const slug=await scalar("select public.create_meeting_share_link($1,'v45-team')",[copy]);
      await asUser('','anon');const shared=await scalar('select public.get_shared_meeting($1)',[slug]);
      assert.equal(shared.meeting.principal_responsible,'Filip');assert.deepEqual(shared.meeting.secondary_responsibles,['Ana','Ștefan']);
      await asUser(ADMIN);
    });
    await t.test('v46 revisions increase on adds, moves, removal and responsible save', async () => {
      await asUser(ADMIN);
      const id=await scalar("select public.create_meeting('Live state',null,now(),null)");
      const snapshot=()=>scalar('select public.get_meeting_snapshot_v46($1)',[id]);
      const before=await snapshot();assert.equal(before.items.length,0);assert.equal(before.principal,null);
      const first=await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[id,song]);
      const one=await snapshot();assert.ok(one.revision>before.revision);assert.equal(one.items.length,1);
      await db.query('select public.add_song_to_meeting($1,$2,false,null,null)',[id,song]);
      const two=await snapshot();assert.equal(two.items.length,2);assert.ok(two.revision>one.revision);
      await db.query("update public.meetings set principal_responsible='Filip',secondary_responsibles=array['Ana'] where id=$1",[id]);
      const team=await snapshot();assert.equal(team.principal,'Filip');assert.deepEqual(team.secondary,['Ana']);assert.ok(team.revision>two.revision);
      await db.query('select public.place_meeting_item_v45($1,$2,true,null)',[id,first]);
      const moved=await snapshot();assert.equal(moved.items.find((item:any)=>item.id===first).is_backup,true);assert.ok(moved.revision>team.revision);
      await db.query('select public.remove_meeting_item($1,$2)',[id,first]);assert.equal((await snapshot()).items.length,1);
      await asUser(INACTIVE);assert.equal(await snapshot(),null);
      await asUser('','anon');await assert.rejects(snapshot);await asUser(ADMIN);
    });
    await t.test('v46 all-time popularity/history deduplicate meetings and exclude future/template/backup', async () => {
      await asUser(ADMIN);
      const freshSong=await scalar("insert into public.songs(title) values('Usage history unique') returning id");
      const older=await scalar("select public.create_meeting('Older actual',null,now()-interval '10 days',null)");
      const latest=await scalar("select public.create_meeting('Latest actual',null,now()-interval '2 days',null)");
      const future=await scalar("select public.create_meeting('Future',null,now()+interval '3 days',null)");
      const template=await scalar("select public.create_meeting('Template',null,now()-interval '1 day',null)");
      const backup=await scalar("select public.create_meeting('Backup only',null,now()-interval '1 day',null)");
      await db.query('update public.meetings set is_template=true where id=$1',[template]);
      for(const id of [older,latest,latest,future,template])await db.query('select public.add_song_to_meeting($1,$2,false,null,null)',[id,freshSong]);
      await db.query('select public.add_song_to_meeting($1,$2,true,null,null)',[backup,freshSong]);
      const history=await scalar('select public.get_song_history_v46($1)',[freshSong]);
      assert.equal(history.total,3);assert.equal(history.performed_total,2);assert.equal(history.upcoming_total,1);assert.deepEqual(history.entries.map((row:any)=>row.meeting_id),[future,latest,older]);
      const second=await scalar('select public.get_song_history_v46($1,2,1)',[freshSong]);assert.equal(second.entries[0].meeting_id,latest);
      const library=await scalar("select public.list_song_library_v46(p_query=>'Usage history unique',p_sort=>'most_sung')");
      assert.equal(library.total,1);assert.equal(library.songs[0].times_sung,2);assert.equal(library.songs[0].last_used_at,history.last_used_at);
      assert.equal((await scalar("select public.list_song_library_v46(p_query=>'Usage history unique',p_sort=>'most_sung',p_key=>'B#')")).total,0);
      const recent=(await db.query<any>('select * from public.get_song_recent_usage() where song_id=$1',[freshSong])).rows[0];assert.equal(Number(recent.times_used),2);
      await asUser(INACTIVE);assert.equal((await scalar('select public.get_song_history_v46($1)',[freshSong])).total,0);
      assert.equal((await scalar('select public.list_song_library_v46()')).total,0);
      await asUser('','anon');await assert.rejects(()=>db.query('select public.get_song_history_v46($1)',[freshSong]));await asUser(ADMIN);
    });
    await t.test('v46 youth keys match collection/title safely, preserve notes and audit later edits',async()=>{
      await asUser(ADMIN);
      const collection=await scalar("select id from public.song_collections where short_code='TINERI'");
      const add=async(title:string,number:string,key='G')=>{
        const id=await scalar('insert into public.songs(title,default_key) values($1,$2) returning id',[title,key]);
        await db.query('insert into public.song_sources(song_id,collection_id,song_number) values($1,$2,$3)',[id,collection,number]);return id;
      };
      const matched=await add('Am fost născut în păcat','1');
      const minor=await add('Pentru tine-un păcătos','18');
      const alternative=await add('În lumina iubirii Tale','25');
      const unrelated=await add('Altă cântare cu același număr','3');
      const ambiguous1=await add('Ai un loc la cruce și tu','32');const ambiguous2=await add('Ai un loc la cruce și tu','32');
      const outside=await scalar("insert into public.songs(title,default_key) values('Am fost născut în păcat','A') returning id");
      await db.exec('reset role');await db.exec(fs.readFileSync(path.join(dir,'041_v46_youth_keys.sql'),'utf8'));await asUser(ADMIN);
      assert.equal(await scalar('select default_key from public.songs where id=$1',[matched]),'F');
      assert.equal(await scalar('select default_key from public.songs where id=$1',[minor]),'Am');
      assert.equal(await scalar('select default_key from public.songs where id=$1',[alternative]),'G');
      for(const id of [unrelated,ambiguous1,ambiguous2])assert.equal(await scalar('select default_key from public.songs where id=$1',[id]),'G');
      assert.equal(await scalar('select default_key from public.songs where id=$1',[outside]),'A');
      assert.equal(await scalar('select previous_key from public.youth_key_applied_v46 where song_id=$1',[matched]),'G');
      const report=(await db.query<any>('select * from public.get_youth_key_matches_v46()')).rows;
      assert.equal(report.length,476);assert.equal(report.find(row=>row.reference_number==='32').match_status,'ambiguous');
      assert.equal(report.find(row=>row.reference_number==='474').match_status,'review_notation');
      assert.equal(report.find(row=>row.reference_number==='25').original_notation,'G(sau A)');
      await db.query("update public.songs set default_key='Eb' where id=$1",[matched]);
      await db.exec('reset role');await db.exec(fs.readFileSync(path.join(dir,'041_v46_youth_keys.sql'),'utf8'));await asUser(ADMIN);
      assert.equal(await scalar('select default_key from public.songs where id=$1',[matched]),'Eb');
      assert.equal(await scalar("select match_status from public.get_youth_key_matches_v46() where reference_number='1'"),'edited_after_import');
    });
    await t.test('v47 numbering and manual collection are automatic and generic link import is idempotent',async()=>{
      await asUser(ADMIN);
      const collection=await scalar('select public.ensure_manual_collection_v47()');
      assert.equal(await scalar('select public.ensure_manual_collection_v47()'),collection);
      const first=await scalar("insert into public.songs(title) values('Auto number first') returning id");
      const second=await scalar("insert into public.songs(title) values('Auto number second') returning id");
      await db.query("insert into public.song_sources(song_id,collection_id,song_number) values($1,$2,'8b')",[first,collection]);
      await db.query('insert into public.song_sources(song_id,collection_id) values($1,$2)',[second,collection]);
      assert.equal(await scalar('select song_number from public.song_sources where song_id=$1',[second]),'9');
      await db.query("update public.song_sources set song_number='42' where song_id=$1",[second]);
      const link='https://melodia.ro/cantari/Exemplu-test';
      const key=await scalar("select 'web:'||encode(sha256(convert_to($1,'UTF8')),'hex')",[link]);
      const section=[{section_type:'verse',section_label:'Strofa 1',position:1,content:'Text de test suficient de lung pentru import.'}];
      const args=[key,link,'Generic link test','Text de test suficient de lung pentru import.',JSON.stringify(section),[collection]];
      const imported=await scalar('select public.import_reviewed_song_link($1,$2,$3,$4,$5::jsonb,$6::uuid[])',args);
      assert.equal(await scalar('select song_number from public.song_sources where song_id=$1',[imported.songId]),'43');
      const again=await scalar('select public.import_reviewed_song_link($1,$2,$3,$4,$5::jsonb,$6::uuid[])',args);assert.equal(again.songId,imported.songId);assert.equal(again.created,false);
      await assert.rejects(()=>db.query('select public.import_reviewed_song_link($1,$2,$3,$4,$5::jsonb,$6::uuid[])',['web:wrong',...args.slice(1)]));
      await asUser(VIEWER);await assert.rejects(()=>db.query('select public.ensure_manual_collection_v47()'));await asUser(ADMIN);
    });
    await t.test('v47 merge preserves original source rows, link identities, proposals and program metadata',async()=>{
      await asUser(ADMIN);
      const primary=await scalar("insert into public.songs(title,lyrics_text) values('Merge sample','Principal lyrics retained') returning id");
      const duplicate=await scalar("insert into public.songs(title,lyrics_text) values('Merge sample','Duplicate lyrics archived') returning id");
      const collection=await scalar('select public.ensure_manual_collection_v47()');
      const source=await scalar("insert into public.song_sources(song_id,collection_id,song_number,source_title) values($1,$2,'222','Original source identity') returning id",[duplicate,collection]);
      await db.query("insert into public.song_sections(song_id,section_type,section_label,position,content) values($1,'verse','Strofa 1',1,'Archived duplicate section')",[duplicate]);
      const meetingId=await scalar("select public.create_meeting('Merge program',null,now(),null)");
      const item=await scalar("select public.add_song_to_meeting($1,$2,false,'F','Observații păstrate')",[meetingId,duplicate]);
      await db.query("update public.meeting_items set responsible_name='Solist Test' where id=$1",[item]);
      const slug=await scalar("select public.create_meeting_share_link($1,'merge-v47')",[meetingId]);
      await db.query('update public.meeting_share_links set allow_contributions=true where meeting_id=$1',[meetingId]);
      await db.query("select public.add_public_meeting_contribution($1,'song',$2,null,null,false,null,null,null)",[slug,duplicate]);
      const reference='resursecrestine:987654';const url='https://www.resursecrestine.ro/cantece/987654/merge';
      await db.query("select public.import_reviewed_song_link($1,$2,'Merge sample','Text suficient de lung pentru import verificat',$3::jsonb,$4::uuid[],$5)",[reference,url,JSON.stringify([{section_type:'verse',section_label:'Strofa 1',position:1,content:'Text suficient de lung pentru import verificat'}]),[collection],duplicate]);
      const result=await scalar('select public.merge_duplicate_songs($1,$2::uuid[])',[primary,[duplicate]]);assert.equal(result.merged,1);
      assert.equal(await scalar('select song_id from public.song_sources where id=$1',[source]),primary);
      assert.equal(await scalar('select song_id from public.song_link_imports where source_key=$1',[reference]),primary);
      assert.equal(await scalar('select song_id from public.public_meeting_contributions where meeting_id=$1',[meetingId]),primary);
      assert.equal(await scalar('select song_id from public.meeting_items where id=$1',[item]),primary);
      assert.equal(await scalar('select notes from public.meeting_items where id=$1',[item]),'Observații păstrate');
      assert.equal(await scalar('select selected_key from public.meeting_items where id=$1',[item]),'F');
      assert.equal(await scalar('select lyrics_text from public.songs where id=$1',[primary]),'Principal lyrics retained');
      const archive=await scalar('select archived_songs from public.song_merge_history_v47 where primary_song_id=$1',[primary]);
      assert.equal(archive[0].song.lyrics_text,'Duplicate lyrics archived');assert.equal(archive[0].sections[0].content,'Archived duplicate section');
      await asUser(VIEWER);await assert.rejects(()=>db.query('select public.merge_duplicate_songs($1,$2::uuid[])',[primary,[song]]));assert.equal(await scalar('select count(*) from public.song_merge_history_v47'),0);await asUser(ADMIN);
    });
    await t.test('v47 bulk merge validates all groups and rolls back on any invalid group',async()=>{
      await asUser(ADMIN);
      const make=async(title:string)=>scalar('insert into public.songs(title) values($1) returning id',[title]);
      const [a,b,c,d]=await Promise.all([make('Bulk A'),make('Bulk A'),make('Bulk B'),make('Bulk B')]);
      await assert.rejects(()=>db.query('select public.merge_duplicate_song_groups_v47($1::jsonb)',[JSON.stringify([{primary:a,duplicates:[b]},{primary:c,duplicates:[b]}])]));
      assert.equal(await scalar('select count(*) from public.songs where id=any($1::uuid[])',[[a,b,c,d]]),4);
      const inactive=await make('Bulk A');await db.query('update public.songs set is_active=false where id=$1',[inactive]);
      const candidates=(await db.query<any>('select * from public.find_duplicate_song_candidates(200)')).rows;
      assert.equal(candidates.find(row=>row.title_hint==='Bulk A').song_count,2);
      await asUser(INACTIVE);assert.equal((await db.query('select * from public.find_duplicate_song_candidates(200)')).rows.length,0);await asUser(ADMIN);
      const result=await scalar('select public.merge_duplicate_song_groups_v47($1::jsonb)',[JSON.stringify([{primary:a,duplicates:[b]},{primary:c,duplicates:[d]}])]);
      assert.equal(result.groups,2);assert.equal(result.merged,2);assert.equal(await scalar('select count(*) from public.songs where id=any($1::uuid[])',[[a,b,c,d]]),2);
    });
    await t.test('v48 new accounts stay pending, admins approve, and the last active admin is protected',async()=>{
      await db.exec('reset role');
      const freshId='00000000-0000-0000-0000-000000000048';
      await db.query('insert into auth.users(id,email) values($1,$2)',[freshId,'pending@example.org']);
      assert.equal(await scalar('select is_active from public.profiles where id=$1',[freshId]),false);
      assert.equal(await scalar('select role from public.profiles where id=$1',[freshId]),'viewer');
      await asUser(freshId);assert.equal(await scalar('select count(*) from public.songs'),0);
      await assert.rejects(()=>db.query("select public.admin_set_profile_v48($1,'admin',true)",[freshId]));
      await asUser(ADMIN);await db.query("select public.admin_set_profile_v48($1,'admin',true)",[freshId]);
      assert.equal(await scalar('select count(*) from public.profiles where role=\'admin\' and is_active'),2);
      await asUser(freshId);await db.query("select public.admin_set_profile_v48($1,'admin',false)",[ADMIN]);
      await assert.rejects(()=>db.query("select public.admin_set_profile_v48($1,'viewer',false)",[freshId]),/administrator activ/);
      await db.query("select public.admin_set_profile_v48($1,'admin',true)",[ADMIN]);
      await asUser(ADMIN);await db.query("select public.admin_set_profile_v48($1,'viewer',false)",[freshId]);
    });
    await t.test('v48 audit records mutations without credentials or lyrics and cannot be forged or erased',async()=>{
      await asUser(ADMIN);
      const id=await scalar("insert into public.songs(title,lyrics_text,notes) values('Audit example','PRIVATE LYRIC TEXT','PRIVATE NOTE TEXT') returning id");
      const log=(await db.query<any>("select * from public.activity_log_v48 where resource_type='songs' and resource_id=$1 order by id desc limit 1",[id])).rows[0];
      assert.equal(log.actor_id,ADMIN);assert.equal(log.event_type,'insert');assert.ok(log.details.fields.includes('lyrics_text'));
      assert.ok(!JSON.stringify(log).includes('PRIVATE LYRIC TEXT'));assert.ok(!JSON.stringify(log).includes('PRIVATE NOTE TEXT'));
      await db.query("select public.record_activity_v48('request.view','/songs?token=SECRET',$1::jsonb)",[JSON.stringify({password:'SECRET PASSWORD',service_role:'SECRET KEY',query:'visible search'})]);
      const read=(await db.query<any>("select * from public.activity_log_v48 where event_type='request.view' order by id desc limit 1")).rows[0];
      assert.equal(read.path,'/songs');assert.ok(!JSON.stringify(read).includes('SECRET'));assert.equal(read.details.query,'visible search');
      await assert.rejects(()=>db.query('delete from public.activity_log_v48'));
      await assert.rejects(()=>db.query("insert into public.activity_log_v48(event_type) values('forged')"));
      await asUser(VIEWER);assert.equal(await scalar('select count(*) from public.activity_log_v48'),0);
      await assert.rejects(()=>db.query("select public.record_auth_failure_v48('auth.failure','test@example.org')"));
      await asUser(INACTIVE);await assert.rejects(()=>db.query("select public.record_activity_v48('request.view','/songs')"));
      await asUser('','anon');await assert.rejects(()=>db.query('select * from public.activity_log_v48'));
      assert.equal(await scalar('select public.songapp_health_v48()'),true);await asUser(ADMIN);
    });
    await t.test('v48 anonymous share is scoped and read-only unless contributions are enabled',async()=>{
      await asUser(ADMIN);const id=await scalar("select public.create_meeting('Public read only',null,now(),null)");
      await db.query('select public.add_song_to_meeting($1,$2,false,null,null)',[id,song]);
      const slug=await scalar("select public.create_meeting_share_link($1,'v48-public')",[id]);
      await asUser('','anon');const share=await scalar('select public.get_shared_meeting($1)',[slug]);assert.equal(share.items.length,1);assert.equal(share.meeting.allow_contributions,false);
      assert.equal((await db.query("select * from public.public_search_songs_for_share($1,'Song',10)",[slug])).rows.length,0);
      await assert.rejects(()=>db.query("select public.add_public_meeting_contribution($1,'song',$2,null,null,false,null,null,null)",[slug,song]));
      assert.equal(await scalar('select public.record_public_view_v48($1)',[slug]),true);
      assert.equal(await scalar("select public.record_public_view_v48('missing')"),false);
      await asUser(ADMIN);await db.query('update public.meeting_share_links set allow_contributions=true where meeting_id=$1',[id]);
      await asUser('','anon');assert.ok((await db.query("select * from public.public_search_songs_for_share($1,'Song',10)",[slug])).rows.length>0);
      await asUser(ADMIN);await db.query('update public.meeting_share_links set is_active=false where meeting_id=$1',[id]);
      await asUser('','anon');assert.equal(await scalar('select public.get_shared_meeting($1)',[slug]),null);await asUser(ADMIN);
    });
    let run: string; let token: string; let claim:any;
    await t.test('enqueue is idempotent, worker cannot be invoked by user',async()=>{
      await asUser(ADMIN);
      run=await scalar('select public.enqueue_external_sync(1,25,false)');
      assert.equal(await scalar('select public.enqueue_external_sync(1,25,false)'),run);
      await assert.rejects(()=>db.query('select public.claim_external_sync()'));
      await assert.rejects(()=>db.query("update public.external_sync_runs set status='finished'"));
      await asUser('', 'service_role');
      claim=await scalar('select public.claim_external_sync()');token=claim.lease_token;
      assert.equal(claim.id,run);
      assert.equal(await scalar('select public.claim_external_sync()'),null);
    });
    await t.test('expired lease resumes, stale token cannot checkpoint',async()=>{
      await db.query("update public.external_sync_runs set lease_until=now()-interval '1 second' where id=$1",[run]);
      claim=await scalar('select public.claim_external_sync()');
      assert.notEqual(claim.lease_token,token);
      assert.equal(await scalar("select public.checkpoint_external_scan($1,$2,1,'[]')",[run,token]),false);
      token=claim.lease_token;
      const links=[{url:'https://www.resursecrestine.ro/cantece/123/a',externalId:'resursecrestine.ro/cantece/123/a'}];
      assert.equal(await scalar('select public.checkpoint_external_scan($1,$2,1,$3)',[run,token,JSON.stringify(links)]),true);
    });
    await t.test('song commit and cursor advance together; retry is fenced',async()=>{
      claim=await scalar('select public.claim_external_sync()'); token=claim.lease_token;
      const parsed={title:'External',lyrics:'Versuri externe suficiente',hash:'hash1',sections:[{section_type:'verse',section_label:'Strofa 1',position:1,content:'Versuri externe suficiente'}]};
      assert.equal(await scalar('select public.commit_external_sync_song($1,$2,$3)',[run,token,JSON.stringify(parsed)]),true);
      assert.equal(await scalar('select public.commit_external_sync_song($1,$2,$3)',[run,token,JSON.stringify(parsed)]),false);
      assert.equal(await scalar('select imported_count from public.external_sync_runs where id=$1',[run]),1);
      assert.equal(await scalar('select count(*) from public.external_song_refs'),1);
      assert.equal(await scalar('select status from public.external_sync_runs where id=$1',[run]),'finished');
    });
    await t.test('overwrite off preserves local edits and cancellation fences in-flight work',async()=>{
      await asUser(ADMIN);
      run=await scalar('select public.enqueue_external_sync(1,25,false)');
      await asUser('','service_role');claim=await scalar('select public.claim_external_sync()');
      await scalar('select public.checkpoint_external_scan($1,$2,1,$3)',[run,claim.lease_token,JSON.stringify([{url:'https://www.resursecrestine.ro/cantece/123/a',externalId:'resursecrestine.ro/cantece/123/a'}])]);
      claim=await scalar('select public.claim_external_sync()');
      const parsed={title:'Should not replace',lyrics:'Changed source',hash:'hash2',sections:[]};
      await scalar('select public.commit_external_sync_song($1,$2,$3)',[run,claim.lease_token,JSON.stringify(parsed)]);
      assert.equal(await scalar('select title from public.songs where id=(select song_id from public.external_song_refs limit 1)'),'External');
      assert.equal(await scalar('select skipped_count from public.external_sync_runs where id=$1',[run]),1);
      await asUser(ADMIN);run=await scalar('select public.enqueue_external_sync(1,25,true)');
      await asUser('','service_role');claim=await scalar('select public.claim_external_sync()');token=claim.lease_token;
      await asUser(ADMIN);await db.query('select public.cancel_external_sync($1)',[run]);
      await asUser('','service_role');
      assert.equal(await scalar("select public.checkpoint_external_scan($1,$2,1,'[]')",[run,token]),false);
      assert.equal(await scalar('select status from public.external_sync_runs where id=$1',[run]),'cancelled');
    });
    await t.test('reviewed link import is atomic across collections and duplicate submissions',async()=>{
      await asUser(ADMIN);
      const collections=(await db.query<{id:string}>("select id from public.song_collections where is_active order by name limit 2")).rows.map(r=>r.id);
      assert.equal(collections.length,2);
      const args=['resursecrestine:999','https://www.resursecrestine.ro/cantece/999/test','Link import test','Versuri noi în preview cu text de test',JSON.stringify([{section_type:'verse',section_label:'Strofa 1',position:1,content:'Versuri noi în preview cu text de test'}]),collections];
      const query='select public.import_reviewed_song_link($1,$2,$3,$4,$5,$6)';
      const imported=await scalar(query,args);assert.equal(imported.created,true);
      assert.equal(await scalar('select count(*) from public.song_sources where song_id=$1',[imported.songId]),2);
      const again=await scalar(query,args);assert.equal(again.songId,imported.songId);assert.equal(again.created,false);
      assert.equal(await scalar('select count(*) from public.song_link_imports where source_key=$1',[args[0]]),1);
      const matches=await scalar('select public.find_link_song_matches($1,$2)',[args[0],args[2]]);assert.equal(matches[0].songId,imported.songId);assert.equal(matches[0].sourceMatch,true);
      const bad=[...args];bad[0]='resursecrestine:1000';bad[1]='https://www.resursecrestine.ro/cantece/1000/test';bad[5]=['00000000-0000-0000-0000-999999999999'];
      const before=await scalar('select count(*) from public.songs');await assert.rejects(()=>db.query(query,bad));assert.equal(await scalar('select count(*) from public.songs'),before);
      await asUser(VIEWER);await assert.rejects(()=>db.query(query,args));
      await asUser(INACTIVE);assert.deepEqual(await scalar('select public.find_link_song_matches($1,$2)',[args[0],args[2]]),[]);await assert.rejects(()=>db.query(query,args));
      await asUser(ADMIN);
    });
    await t.test('legacy source songs are reused with their local edits preserved',async()=>{
      await asUser(ADMIN);
      const collections=(await db.query<{id:string}>('select id from public.song_collections where is_active limit 1')).rows.map(r=>r.id);
      const existingId=await scalar("select song_id from public.external_song_refs limit 1");
      await db.query("update public.songs set lyrics_text='Versuri corectate local, păstrate în bibliotecă.' where id=$1",[existingId]);
      const matches=await scalar("select public.find_link_song_matches('resursecrestine:123','Alt titlu')");assert.equal(matches[0].songId,existingId);
      const imported=await scalar("select public.import_reviewed_song_link('resursecrestine:123','https://www.resursecrestine.ro/cantece/123/a','Titlu din pagină','Versuri din preview care nu trebuie să suprascrie',$1,$2)",[JSON.stringify([{section_type:'verse',content:'Text'}]),collections]);
      assert.equal(imported.songId,existingId);assert.equal(imported.created,false);
      assert.equal(await scalar('select lyrics_text from public.songs where id=$1',[existingId]),'Versuri corectate local, păstrate în bibliotecă.');
    });
    await t.test('suspending legacy sync cancels jobs while preserving imported library data',async()=>{
      await asUser(ADMIN);const run=await scalar('select public.enqueue_external_sync(1,25,false)');
      await db.exec('reset role');const before=await scalar('select count(*) from public.songs');
      await db.exec(fs.readFileSync(path.join(dir,'037_v43_link_import.sql'),'utf8'));
      assert.equal(await scalar('select count(*) from public.songs'),before);
      assert.equal(await scalar('select status from public.external_sync_runs where id=$1',[run]),'cancelled');
    });
    await t.test('migration 036 can be safely rerun',async()=>{
      await db.exec('reset role');
      await db.exec(fs.readFileSync(path.join(dir,'036_v42_stabilization.sql'),'utf8'));
    });
    await t.test('packaged UPDATE and fresh INSTALL execute successfully',async()=>{
      await db.exec('reset role');
      await db.exec(fs.readFileSync(path.join(process.cwd(),'UPDATE-V42.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'UPDATE-V43.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'UPDATE-V44.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'UPDATE-V45.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'UPDATE-V45.sql'),'utf8')); // rerun safe
      await db.exec(fs.readFileSync(path.join(process.cwd(),'UPDATE-V46.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'UPDATE-V46.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'UPDATE-V47.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'UPDATE-V47.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'UPDATE-V48.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'UPDATE-V48.sql'),'utf8'));
      const fresh = new PGlite({ extensions: { pg_trgm, unaccent, pgcrypto } });
      try {
        await fresh.exec(setup);
        await fresh.exec(fs.readFileSync(path.join(process.cwd(),'INSTALL-NEW.sql'),'utf8'));
        assert.equal((await fresh.query<{n:number}>('select count(*)::integer as n from public.songs')).rows[0].n,0);
      } finally { await fresh.close(); }
    });
  } finally { await db.close(); }
});
