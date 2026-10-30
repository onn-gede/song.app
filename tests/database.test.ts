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
    const dir=path.join(process.cwd(),'supabase','migrations');
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
    await t.test('v67 welcome shows only latest started and next programs, hard maximum four without older pages',async()=>{
      await asUser(ADMIN);const ids:string[]=[];
      try{
        for(const [title,delta] of [['Vechi 1',-10000],['Vechi 2',-1440],['Ultimul',-30],['Viitor 1',30],['Viitor 2',60],['Viitor 3',90],['Viitor 4',120],['Viitor 5',150]] as const){const id=await scalar("insert into meetings(title,meeting_date) values($1,now()+$2*interval '1 minute') returning id",[title,delta]);ids.push(id);await scalar("select create_meeting_share_link_v66($1,'v67',true)",[id]);}
        await asUser('','anon');let data=await scalar('select list_public_programs_v66(1,999)');assert.equal(data.total,4);assert.equal(data.pageSize,4);assert.deepEqual(data.programs.map((p:any)=>p.title),['Ultimul','Viitor 1','Viitor 2','Viitor 3']);assert.equal(data.programs[0].phase,'in_progress');
        assert.deepEqual((await scalar('select list_public_programs_v66(1000,999)')).programs,data.programs);
        await asUser(ADMIN);await db.query('delete from meetings where id=any($1::uuid[])',[ids.slice(0,3)]);await asUser('','anon');data=await scalar('select list_public_programs_v66()');assert.deepEqual(data.programs.map((p:any)=>p.title),['Viitor 1','Viitor 2','Viitor 3','Viitor 4']);
        await asUser(ADMIN);await db.query('delete from meetings where id=any($1::uuid[])',[ids]);await asUser('','anon');assert.equal((await scalar('select list_public_programs_v66()')).total,0);
      }finally{await asUser(ADMIN);await db.query('delete from meetings where id=any($1::uuid[])',[ids]);}
    });
    await t.test('v66 public listing remains scoped and anonymous suggestions await review',async()=>{
      await asUser(ADMIN);const ids:string[]=[];const target=await scalar("insert into songs(title,lyrics_text) values('Propunere anonimă v66','Versuri de test') returning id");
      try{
        for(const [title,delta] of [['Curent',-30],['Viitor 1',60],['Viitor 2',120],['Trecut',-300],['Privat',5],['Expirat',10]] as const)ids.push(await scalar("insert into meetings(title,meeting_date) values($1,now()+$2*interval '1 minute') returning id",[title,delta]));
        const slugs:string[]=[];for(let n=0;n<4;n++)slugs.push(await scalar("select create_meeting_share_link_v66($1,'v66',true)",[ids[n]]));
        await db.query("insert into meeting_share_links(meeting_id,public_slug,expires_at) values($1,'v66-expired',now()-interval '1 minute')",[ids[5]]);
        await asUser('','anon');const page=await scalar('select list_public_programs_v66(1,2)');assert.equal(page.total,3);assert.deepEqual(page.programs.map((p:any)=>p.title),['Curent','Viitor 1','Viitor 2']);assert.deepEqual((await scalar('select list_public_programs_v66(2,999)')).programs.map((p:any)=>p.title),['Curent','Viitor 1','Viitor 2']);assert.deepEqual(Object.keys(page.programs[0]).sort(),['date','phase','slug','title']);
        const songProposal=await scalar("select add_public_meeting_contribution($1,'song',$2,null,null,false,null,'Vizitator',null)",[slugs[0],target]);
        const moment=await scalar("select add_public_meeting_contribution($1,'other',null,'Moment propus','Observații',false,null,'Vizitator',null)",[slugs[0]]);
        await assert.rejects(()=>scalar('select accept_public_meeting_contribution($1)',[moment]));
        await asUser(ADMIN);assert.equal(await scalar('select status from public_meeting_contributions where id=$1',[songProposal]),'pending');assert.equal(await scalar('select count(*) from meeting_items where meeting_id=$1',[ids[0]]),0);
        await db.query('update meeting_share_links set allow_contributions=false where public_slug=$1',[slugs[0]]);
        await asUser('','anon');await assert.rejects(()=>scalar("select add_public_meeting_contribution($1,'other',null,'Refuzat','Text',false,null,null,null)",[slugs[0]]));
        await db.exec('reset role');await db.exec(fs.readFileSync('supabase/updates/UPDATE-V66.sql','utf8'));await asUser(ADMIN);assert.equal(await scalar('select allow_contributions from meeting_share_links where public_slug=$1',[slugs[0]]),false);
        await db.exec('reset role');await db.query("delete from release_flags_v66 where key='visitor_suggestions'");await db.exec(fs.readFileSync('supabase/updates/UPDATE-V66.sql','utf8'));await asUser(ADMIN);assert.equal(await scalar('select allow_contributions from meeting_share_links where public_slug=$1',[slugs[0]]),true);
        await scalar('select accept_public_meeting_contribution($1)',[moment]);assert.equal(await scalar('select status from public_meeting_contributions where id=$1',[moment]),'accepted');assert.equal(await scalar('select count(*) from meeting_items where meeting_id=$1',[ids[0]]),1);
      }finally{await db.exec('reset role');await db.exec(fs.readFileSync('supabase/updates/UPDATE-V67.sql','utf8'));await asUser(ADMIN);await db.query('delete from meetings where id=any($1::uuid[])',[ids]);await db.query('delete from songs where id=$1',[target]);}
    });
    await t.test('v65 only administrators manage profiles, including direct table requests',async()=>{
      const editor='00000000-0065-0000-0000-000000000001';await db.exec('reset role');
      await db.query('insert into auth.users(id) values($1)',[editor]);await db.query("update profiles set role='editor',is_active=true where id=$1",[editor]);
      try{
        await asUser(editor);await assert.rejects(()=>scalar("select admin_set_profile_v48($1,'admin',true)",[VIEWER]));await assert.rejects(()=>scalar('select admin_moderate_user_v57($1,false)',[VIEWER]));
        await db.query("update profiles set role='admin' where id=$1",[editor]);assert.equal(await scalar('select role from profiles where id=$1',[editor]),'editor');
        await assert.rejects(()=>db.query("insert into profiles(id,role,is_active) values('ffffffff-ffff-ffff-ffff-ffffffffffff','admin',true)"));
        await db.query('delete from profiles where id=$1',[editor]);assert.equal(await scalar('select count(*) from profiles where id=$1',[editor]),1);
        await asUser(ADMIN);await scalar("select admin_set_profile_v48($1,'worship_leader',true)",[editor]);assert.equal(await scalar('select role from profiles where id=$1',[editor]),'worship_leader');
        await asUser(editor);await assert.rejects(()=>scalar("select admin_set_profile_v48($1,'admin',true)",[VIEWER]));
      }finally{await db.exec('reset role');await db.query('delete from auth.users where id=$1',[editor]);await asUser(ADMIN);}
    });
    await t.test('v65 guest discovery exposes only next valid published program, including in-progress',async()=>{
      await asUser(ADMIN);const ids:string[]=[];
      try{
        for(const [title,delta,template] of [['Private soon',10,false],['Published next',60,false],['Published later',120,false],['Template',1,true],['Current',-60,false]] as const){ids.push(await scalar("insert into meetings(title,meeting_date,is_template) values($1,now()+$2*interval '1 minute',$3) returning id",[title,delta,template]));}
        for(let n=1;n<ids.length;n++)await db.query('insert into meeting_share_links(meeting_id,public_slug) values($1,$2)',[ids[n],'guest65-'+n]);
        await asUser('','anon');const current=await scalar('select next_public_program_v65()');assert.equal(current.title,'Current');assert.deepEqual(Object.keys(current).sort(),['date','slug','title']);
        await asUser(ADMIN);await db.query('update meeting_share_links set is_active=false where meeting_id=$1',[ids[4]]);
        await asUser('','anon');assert.equal((await scalar('select next_public_program_v65()')).title,'Published next');
        await asUser(ADMIN);await db.query("update meeting_share_links set expires_at=now()-interval '1 minute' where meeting_id=$1",[ids[1]]);
        await asUser('','anon');assert.equal((await scalar('select next_public_program_v65()')).title,'Published later');
        await asUser(ADMIN);await db.query('update meeting_share_links set is_active=false where meeting_id=$1',[ids[2]]);await asUser('','anon');assert.equal(await scalar('select next_public_program_v65()'),null);
      }finally{await asUser(ADMIN);await db.query('delete from meetings where id=any($1::uuid[])',[ids]);}
    });
    await t.test('v65 corrected usage retracts popularity and schedule, retains program, and can be restored',async()=>{
      await asUser(ADMIN);const song=await scalar("insert into songs(title) values('Istoric corectat v65') returning id"),mid=await scalar("insert into meetings(title,meeting_date) values('Program istoric v65',now()-interval '3 hours') returning id");
      try{
        await db.query('insert into meeting_items(meeting_id,position,song_id) values($1,1,$2)',[mid,song]);
        assert.equal(await scalar('select count(*) from song_performance_occurrences_v46 where song_id=$1',[song]),1);
        await asUser(VIEWER);await assert.rejects(()=>scalar('select set_song_usage_exclusion_v65($1,$2,true)',[song,[mid]]));await asUser(ADMIN);
        await scalar('select set_song_usage_exclusion_v65($1,$2,true)',[song,[mid]]);
        assert.equal(await scalar('select count(*) from song_performance_occurrences_v46 where song_id=$1',[song]),0);assert.equal(await scalar('select count(*) from meeting_items where song_id=$1',[song]),1);
        assert.equal(await scalar('select count(*) from get_song_recent_usage(30) where song_id=$1',[song]),0);
        const history=await scalar('select get_song_history_v46($1)',[song]);assert.equal(history.performed_total,0);assert.equal(history.entries[0].is_excluded,true);assert.equal(history.last_used_at,null);
        assert.equal(await scalar('select count(*) from song_program_events_v52($1)',[song]),0);
        await scalar('select set_song_usage_exclusion_v65($1,$2,false)',[song,[mid]]);assert.equal(await scalar('select count(*) from song_performance_occurrences_v46 where song_id=$1',[song]),1);
        const data=await scalar('select move_program_item_v65($1,(select id from meeting_items where meeting_id=$1),true)',[mid]);assert.equal(data.items[0].is_backup,true);assert.equal(await scalar('select count(*) from song_performance_occurrences_v46 where song_id=$1',[song]),0);
      }finally{await asUser(ADMIN);await db.query('delete from meetings where id=$1',[mid]);await db.query('delete from songs where id=$1',[song]);}
    });
    await t.test('v65 youth first-verse repair previews, refuses stale data, preserves other sections and supports protected undo',async()=>{
      await asUser(ADMIN);const song=await scalar("insert into songs(title,lyrics_text) values('Primul vers pierdut','A doua linie\n\nRefrenul\n\nStrofa a doua') returning id"),collection=await scalar("select id from song_collections where short_code='TINERI'");let sec:string;
      try{
        await db.query("insert into song_sources(song_id,collection_id,song_number,source_title) values($1,$2,'v65','test')",[song,collection]);
        sec=await scalar("insert into song_sections(song_id,position,content) values($1,1,'A doua linie') returning id",[song]);
        await db.query("insert into song_sections(song_id,position,section_type,content) values($1,2,'chorus','Refrenul'),($1,3,'verse','Strofa a doua')",[song]);
        const find=async()=> (await scalar('select youth_lyric_candidates_v65()')).find((r:any)=>r.id===song);
        const c=await find();assert.equal(c.before,'A doua linie');assert.equal(c.after,'Primul vers pierdut\nA doua linie');assert.equal(await scalar('select content from song_sections where id=$1',[sec]),'A doua linie');
        await asUser(VIEWER);await assert.rejects(()=>scalar('select youth_lyric_candidates_v65()'));await assert.rejects(()=>scalar('select repair_youth_lyrics_v65($1)',[[c]]));await asUser(ADMIN);
        await db.query("update songs set notes='Notiță păstrată',lyrics_text=lyrics_text||' modificat' where id=$1",[song]);await assert.rejects(()=>scalar('select repair_youth_lyrics_v65($1)',[[c]]));
        const current=await find();assert.equal(await scalar('select repair_youth_lyrics_v65($1)',[[current]]),1);
        assert.equal(await scalar('select content from song_sections where id=$1',[sec]),'Primul vers pierdut\nA doua linie');assert.equal(await scalar("select content from song_sections where song_id=$1 and position=2",[song]),'Refrenul');assert.equal(await scalar('select notes from songs where id=$1',[song]),'Notiță păstrată');assert.equal(await find(),undefined);
        await assert.rejects(()=>scalar('select repair_youth_lyrics_v65($1)',[[current]]));const repairId=await scalar('select id from youth_lyric_repairs_v65 where song_id=$1',[song]);
        await scalar('select undo_youth_lyrics_v65($1)',[repairId]);assert.equal(await scalar('select content from song_sections where id=$1',[sec]),'A doua linie');assert.ok(await find());
        await scalar('select repair_youth_lyrics_v65($1)',[[await find()]]);const recent=await scalar('select id from youth_lyric_repairs_v65 where song_id=$1 and reverted_at is null',[song]);await db.query("update song_sections set content='Refren editat manual' where song_id=$1 and position=2",[song]);await assert.rejects(()=>scalar('select undo_youth_lyrics_v65($1)',[recent]));
      }finally{await asUser(ADMIN);await db.query('delete from songs where id=$1',[song]);}
    });
    await t.test('v64 admin-only export, rollback preview, atomic restore, expiry and concurrency protection',async()=>{
      await asUser(ADMIN);
      const song=await scalar("insert into songs(title,lyrics_text) values('Backup test','Strofa originală') returning id");
      const meeting=await scalar("insert into meetings(title,meeting_date,principal_responsible,secondary_responsibles) values('Export program',now(),'Filip',array['Ana']) returning id");
      await db.query("insert into meeting_items(meeting_id,position,song_id,responsible_name,notes,performance_structure) values($1,1,$2,'Solist test','Observații test','S,R')",[meeting,song]);
      const pkg=await scalar('select export_package_v64($1)',[meeting]);
      assert.equal(pkg.tables.meetings[0].principal_responsible,'Filip');assert.equal(pkg.tables.meeting_items[0].notes,'Observații test');assert.equal(pkg.tables.songs.length,1);assert.equal(pkg.kind,'program');
      const full=await scalar('select export_package_v64()');assert.ok(full.tables.songs.length>5205);assert.ok(full.referenceOnly.profiles.length>=3);
      await asUser(VIEWER);await assert.rejects(()=>scalar('select export_package_v64()'));await assert.rejects(()=>scalar("select restore_package_v64('{}')"));assert.equal((await scalar('select export_package_v64($1)',[meeting])).kind,'program');
      await asUser(INACTIVE);await assert.rejects(()=>scalar('select export_package_v64($1)',[meeting]));await asUser('','anon');await assert.rejects(()=>scalar('select export_package_v64($1)',[meeting]));await asUser(ADMIN);
      const old=await scalar('select to_jsonb(s) from songs s where id=$1',[song]);const tables={songs:[{...old,title:'Titlu restaurat'}]};
      const auditBefore=await scalar('select count(*) from activity_log_v48');const preview=await scalar('select restore_package_v64($1)',[tables]);
      assert.equal(preview.summary[0].changed,1);assert.equal(await scalar('select title from songs where id=$1',[song]),'Backup test');assert.equal(await scalar('select count(*) from activity_log_v48'),auditBefore);
      await assert.rejects(()=>scalar('select restore_package_v64($1,$2)',[{songs:[{...old,title:'Conținut schimbat'}]},preview.ticket]));
      await scalar('select restore_package_v64($1,$2)',[tables,preview.ticket]);assert.equal(await scalar('select title from songs where id=$1',[song]),'Titlu restaurat');await assert.rejects(()=>scalar('select restore_package_v64($1,$2)',[tables,preview.ticket]));
      const again=await scalar('select restore_package_v64($1)',[tables]);assert.equal(again.summary[0].unchanged,1);
      await db.query("update songs set title='Editare paralelă' where id=$1",[song]);await assert.rejects(()=>scalar('select restore_package_v64($1,$2)',[tables,again.ticket]));assert.equal(await scalar('select title from songs where id=$1',[song]),'Editare paralelă');
      await assert.rejects(()=>scalar('select restore_package_v64($1)',[{profiles:full.referenceOnly.profiles}]));
      await assert.rejects(()=>scalar('select restore_package_v64($1)',[{songs:[old,old]}]));
      const invalid={songs:[{...old,title:'Nu salva'}],song_categories:[{song_id:song,category_id:'ffffffff-ffff-ffff-ffff-ffffffffffff'}]};await assert.rejects(()=>scalar('select restore_package_v64($1)',[invalid]));assert.equal(await scalar('select title from songs where id=$1',[song]),'Editare paralelă');
      const c1='10000000-0064-0000-0000-000000000001',c2='10000000-0064-0000-0000-000000000002';
      const categories={categories:[{id:c2,name:'Copil backup',slug:'copil-backup-64',parent_id:c1,created_at:old.created_at},{id:c1,name:'Părinte backup',slug:'parinte-backup-64',parent_id:null,created_at:old.created_at}]};
      const cp=await scalar('select restore_package_v64($1)',[categories]);assert.equal(await scalar('select count(*) from categories where id=$1',[c1]),0);await scalar('select restore_package_v64($1,$2)',[categories,cp.ticket]);assert.equal(await scalar('select parent_id from categories where id=$1',[c2]),c1);
      const second=await scalar("insert into meeting_items(meeting_id,position,song_id) values($1,2,$2) returning id",[meeting,song]);
      const orderRows=(await db.query<Record<string,any>>('select to_jsonb(x) as r from meeting_items x where meeting_id=$1 order by position',[meeting])).rows.map(x=>x.r);orderRows[0].position=2;orderRows[1].position=1;
      const orderData={meeting_items:orderRows};const orderPreview=await scalar('select restore_package_v64($1)',[orderData]);await scalar('select restore_package_v64($1,$2)',[orderData,orderPreview.ticket]);assert.equal(await scalar('select position from meeting_items where id=$1',[second]),1);
      await db.query('delete from meetings where id=$1',[meeting]);await db.query('delete from songs where id=$1',[song]);await db.query('delete from categories where id=any($1::uuid[])',[[c1,c2]]);
    });
    await t.test('v49 repeated creation returns one program, preserves quarter-hour and author, and rolls back failed song adds',async()=>{
      await asUser(ADMIN);const token='10000000-0000-0000-0000-000000000049';
      const before=await scalar('select count(*) from public.meetings');
      const args=[token,'Program unic','2026-11-01T08:15:00Z'];
      const sql="select public.create_meeting_once_v49($1,$2,null,$3,null)";
      const id=await scalar(sql,args);assert.equal(await scalar(sql,args),id);
      assert.equal(Number(await scalar('select count(*) from public.meetings')),Number(before)+1);
      assert.equal(await scalar("select to_char(meeting_date at time zone 'Europe/Bucharest','HH24:MI') from public.meetings where id=$1",[id]),'10:15');
      await asUser(VIEWER);await assert.rejects(()=>scalar(sql,args));
      await asUser(INACTIVE);await assert.rejects(()=>scalar(sql,args));
      await asUser('','anon');await assert.rejects(()=>scalar(sql,args));await asUser(ADMIN);
      await assert.rejects(()=>scalar("select public.create_meeting_once_v49('20000000-0000-0000-0000-000000000049','Invalid',null,now(),null,'ffffffff-ffff-ffff-ffff-ffffffffffff',false)"));
      assert.equal(Number(await scalar('select count(*) from public.meetings')),Number(before)+1);
      await db.query('delete from public.meetings where id=$1',[id]);
    });
    await t.test('v49 program search prioritizes title and number, supports lyrics/diacritics and denies inactive/anonymous access',async()=>{
      await asUser(ADMIN);const target=await scalar("insert into public.songs(title,lyrics_text) values('Mii de comori','Bucurie neasemănată') returning id");
      const collection=await scalar('select id from public.song_collections limit 1');
      await db.query("insert into public.song_sources(song_id,collection_id,song_number,source_title) values($1,$2,'98765','Titlu alternativ')",[target,collection]);
      for(const term of ['Mii de','98765','neasemanata','Titlu alternativ']){const rows=(await db.query<any>('select * from public.search_program_songs_v49($1,8)',[term])).rows;assert.ok(rows.some(r=>r.song_id===target),term);}
      assert.equal((await db.query('select * from public.search_program_songs_v49($1,2)',['Song'])).rows.length,2);
      assert.equal((await db.query('select * from public.search_program_songs_v49($1,8)',['%'])).rows.length,0);
      assert.ok(Number(await scalar("select count(*) from public.activity_log_v48 where event_type='search'"))>0);
      await asUser(VIEWER);assert.ok((await db.query('select * from public.search_program_songs_v49($1,8)',['comori'])).rows.length);
      await asUser(INACTIVE);await assert.rejects(()=>db.query("select * from public.search_program_songs_v49('comori',8)"));
      await asUser('','anon');await assert.rejects(()=>db.query("select * from public.search_program_songs_v49('comori',8)"));
      await asUser(ADMIN);await db.query('delete from public.songs where id=$1',[target]);
    });
    await t.test('v52 collections get colors, selected source survives add/copy/share and color changes advance program revision',async()=>{
      await asUser(ADMIN);
      const s1=await scalar("insert into public.songs(title,lyrics_text) values('Piesă cu două surse','Versuri de test') returning id");
      const s2=await scalar("insert into public.songs(title,lyrics_text) values('Altă piesă','Versuri') returning id");
      const c1=await scalar("insert into public.song_collections(name,short_code) values('Tineri test','T52') returning id");
      const c2=await scalar("insert into public.song_collections(name,short_code) values('Carte test','C52') returning id");
      assert.notEqual(await scalar('select color from public.song_collections where id=$1',[c1]),await scalar('select color from public.song_collections where id=$1',[c2]));
      const src1=await scalar("insert into public.song_sources(song_id,collection_id,song_number) values($1,$2,'380A') returning id",[s1,c1]);
      const src2=await scalar("insert into public.song_sources(song_id,collection_id,song_number) values($1,$2,'004') returning id",[s1,c2]);
      const wrong=await scalar("insert into public.song_sources(song_id,collection_id,song_number) values($1,$2,'99') returning id",[s2,c1]);
      const m=await scalar("select public.create_meeting('Surse',null,now()+interval '1 day',null)");
      const item=await scalar('select public.add_program_song_v52($1,$2,$3,false,null,null)',[m,s1,src2]);
      const snap=await scalar('select public.get_meeting_snapshot_v46($1)',[m]);assert.equal(snap.items[0].selected_source_id,src2);assert.equal(snap.items[0].sources.length,2);assert.ok(snap.items[0].sources.some((v:any)=>v.number==='004'));
      await assert.rejects(()=>scalar('select public.add_program_song_v52($1,$2,$3,false,null,null)',[m,s1,wrong]));assert.equal(Number(await scalar('select count(*) from public.meeting_items where meeting_id=$1',[m])),1);
      await db.query("update public.song_collections set color='#7e22ce' where id=$1",[c2]);const newer=await scalar('select public.get_meeting_snapshot_v46($1)',[m]);assert.ok(newer.revision>snap.revision);assert.equal(newer.items[0].sources.find((v:any)=>v.source_id===src2).color,'#7e22ce');
      await assert.rejects(()=>db.query("update public.song_collections set color='invalid' where id=$1",[c2]));
      const copy=await scalar("select public.duplicate_meeting($1,'Copie surse',now()+interval '2 days')",[m]);assert.equal(await scalar('select selected_source_id from public.meeting_items where meeting_id=$1',[copy]),src2);
      const share=await scalar("select public.create_meeting_share_link($1,'test-v52-surse')",[m]);
      await asUser('','anon');const shared=await scalar('select public.get_shared_meeting($1)',[share]);assert.equal(shared.items[0].selected_source_id,src2);assert.equal(shared.items[0].sources.length,2);await assert.rejects(()=>scalar('select public.song_sources_v52($1)',[s1]));
      await asUser(VIEWER);await assert.rejects(()=>scalar('select public.add_program_song_v52($1,$2,$3,false,null,null)',[m,s1,src1]));
      await asUser(ADMIN);await db.query('delete from public.meetings where id=any($1::uuid[])',[[m,copy]]);await db.query('delete from public.songs where id=any($1::uuid[])',[[s1,s2]]);await db.query('delete from public.song_collections where id=any($1::uuid[])',[[c1,c2]]);
    });
    await t.test('v57 global numeric search normalizes zero padding across every collection and confirms an idempotent add',async()=>{
      await asUser(ADMIN);const ids:string[]=[],cs:string[]=[];for(let i=0;i<3;i++){cs.push(await scalar("insert into public.song_collections(name,short_code,source_type,opacity) values($1,$2,'manual',25) returning id",['Cautare57 '+i,'S57_'+i]));ids.push(await scalar('insert into public.songs(title) values($1) returning id',['Cautare57 '+i]));await db.query('insert into public.song_sources(song_id,collection_id,song_number) values($1,$2,$3)',[ids[i],cs[i],['063','63','00063'][i]]);}
      await db.query("insert into public.song_sources(song_id,collection_id,song_number) select $1,$2,'63' from generate_series(1,100)",[ids[0],cs[0]]);
      for(const q of ['063','63','Nr. 063']){const rows=(await db.query<any>('select * from public.search_program_songs_v49($1,30)',[q])).rows;assert.ok(ids.every(id=>rows.some(x=>x.song_id===id)));const lib=await scalar('select public.list_song_library_v46(p_query=>$1)',[q]);assert.ok(ids.every(id=>lib.songs.some((x:any)=>x.id===id)));}
      const mid=await scalar("select public.create_meeting('Test57',null,now(),null)"),src=await scalar('select id from public.song_sources where song_id=$1 order by id limit 1',[ids[1]]),request=await scalar('select gen_random_uuid()');
      const added=await scalar('select public.add_program_song_v57($1,$2,$3,$4,false,null)',[mid,ids[1],request,src]);const again=await scalar('select public.add_program_song_v57($1,$2,$3,$4,false,null)',[mid,ids[1],request,src]);assert.equal(added.itemId,again.itemId);assert.equal(again.snapshot.items.length,1);assert.equal(again.snapshot.items[0].selected_source_id,src);assert.equal(again.snapshot.items[0].sources[0].opacity,25);
      const moment=await scalar("select public.add_moment_v57($1,'other',null,'Detalii','#123456')",[mid]);assert.equal(await scalar('select custom_title from public.meeting_items where id=$1',[moment]),'Diverse');assert.equal(await scalar('select moment_color from public.meeting_items where id=$1',[moment]),'#123456');
      await asUser(VIEWER);await db.query("update public.profiles set moderation_state='hidden' where id=$1",[VIEWER]);assert.equal(await scalar('select moderation_state from public.profiles where id=$1',[VIEWER]),'visible');await assert.rejects(()=>scalar('select public.add_program_song_v57($1,$2,$3,$4,false,null)',[mid,ids[1],request,src]));await assert.rejects(()=>scalar('select public.admin_moderate_user_v57($1,false)',[INACTIVE]));await asUser(ADMIN);await scalar('select public.admin_moderate_user_v57($1,false)',[INACTIVE]);assert.equal(await scalar('select moderation_state from public.profiles where id=$1',[INACTIVE]),'rejected');await scalar('select public.admin_moderate_user_v57($1,true)',[INACTIVE]);assert.equal(await scalar('select moderation_state from public.profiles where id=$1',[INACTIVE]),'hidden');await db.query("update public.profiles set moderation_state='visible' where id=$1",[INACTIVE]);
      await db.query('delete from public.meetings where id=$1',[mid]);await db.query('delete from public.songs where id=any($1::uuid[])',[ids]);await db.query('delete from public.song_collections where id=any($1::uuid[])',[cs]);
    });
    await t.test('v58 preserves complete red-book import and backups with automatic archival disabled',async()=>{
      await asUser(ADMIN);const created:string[]=[],collections:string[]=[];
      for(const code of ['cr']){
        const catalog=JSON.parse(fs.readFileSync(`data/book-catalogs/${code}.json`,'utf8'));const results:string[]=[];
        const destination=await scalar('select public.book_collection_v57($1)',[code]);collections.push(destination.id);
        for(const song of catalog.songs){const args=[code,song.title,song.number,song.lyrics,JSON.stringify(song.sections),JSON.stringify(song.sourceIds),song.url];const result=await scalar('select public.upsert_book_song_v57($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)',args);assert.equal(result.status,'created',`${code} ${song.number}: ${JSON.stringify(result)}`);results.push(result.songId);created.push(result.songId);const repeated=await scalar('select public.upsert_book_song_v57($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)',args);assert.equal(repeated.status,'existing');assert.equal(repeated.songId,result.songId);}
        assert.equal(new Set(results).size,catalog.songs.length);const finish=await scalar('select public.finalize_book_catalog_v57($1,$2::jsonb,$3)',[code,JSON.stringify(results),catalog.songs.length]);assert.equal(finish.songs,code==='cr'?601:266);const first=catalog.songs[0],sid=results[0];await db.query("update public.songs set lyrics_text='Versuri amestecate de înlocuit' where id=$1",[sid]);await scalar('select public.upsert_book_song_v57($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)',[code,first.title,first.number,first.lyrics,JSON.stringify(first.sections),JSON.stringify(first.sourceIds),first.url]);assert.equal(await scalar('select lyrics_text from public.songs where id=$1',[sid]),first.lyrics);await db.exec('reset role');assert.equal(await scalar('select count(*) from public.book_repair_backups_v57 where song_id=$1',[sid]),1);await asUser(ADMIN);
      }
      await asUser(VIEWER);await assert.rejects(()=>scalar("select public.book_collection_v57('cn')"));await assert.rejects(()=>scalar('select count(*) from public.book_repair_backups_v57'));await asUser(ADMIN);
      const cr=JSON.parse(fs.readFileSync('data/book-catalogs/cr.json','utf8')).songs[0],oldId=created[0],crid=collections[0];
      const other=await scalar("insert into public.song_collections(name,short_code,source_type) values('Altă ediție 57','OTHER57','manual') returning id");collections.push(other);await db.query('insert into public.song_sources(song_id,collection_id,song_number) values($1,$2,$3)',[oldId,other,'1']);
      const source=await scalar('select id from public.song_sources where song_id=$1 and collection_id=$2',[oldId,crid]),meeting=await scalar("select public.create_meeting('Referință ediție57',null,now(),null)");await scalar('select public.add_program_song_v52($1,$2,$3,false,null,null)',[meeting,oldId,source]);await db.query("update public.songs set lyrics_text='Versiunea celeilalte colecții rămâne aici' where id=$1",[oldId]);
      const split=await scalar('select public.upsert_book_song_v57($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)',['cr',cr.title,cr.number,cr.lyrics,JSON.stringify(cr.sections),JSON.stringify(cr.sourceIds),cr.url]);assert.notEqual(split.songId,oldId);created.push(split.songId);assert.equal(await scalar('select song_id from public.meeting_items where meeting_id=$1',[meeting]),split.songId);assert.equal(await scalar('select lyrics_text from public.songs where id=$1',[oldId]),'Versiunea celeilalte colecții rămâne aici');await db.query('delete from public.meetings where id=$1',[meeting]);
      await db.query('delete from public.songs where id=any($1::uuid[])',[created]);await db.query('delete from public.song_collections where id=any($1::uuid[])',[collections]);
    });
    await t.test('v58 imports all 803 title/file identities, preserves edits and confirms storage before exposing files',async()=>{
      await asUser(ADMIN);const manifest=JSON.parse(fs.readFileSync('data/black-book-ppt.json','utf8'));const collection=await scalar('select public.presentation_collection_v58(null,$1)',[manifest.collectionName]);assert.equal((await scalar('select public.presentation_collection_v58(null,$1)',[manifest.collectionName])).id,collection.id);await db.query("update public.song_collections set name='Colecție redenumită local' where id=$1",[collection.id]);assert.equal((await scalar('select public.presentation_collection_v58(null,$1)',[manifest.collectionName])).id,collection.id);const ids:string[]=[];
      const register='select public.register_presentation_v58($1,$2,$3,$4,$5,$6,$7)';
      for(const song of manifest.songs){const args=[collection.id,song.number,song.title,song.fileName,song.sha256,song.previewSha256,song.firstLine];const added=await scalar(register,args);assert.equal(added.status,'created');assert.equal(added.complete,false);ids.push(added.songId);await assert.rejects(()=>scalar('select public.complete_presentation_v58($1)',[added.fileId]));const repeated=await scalar(register,args);assert.equal(repeated.songId,added.songId);assert.equal(repeated.fileId,added.fileId);}
      assert.equal(new Set(ids).size,803);assert.equal(Number((await scalar('select public.list_song_library_v46(p_collection=>$1)',[collection.id])).total),803);const matched=await scalar("select public.search_program_songs_v52('063',30,null)");assert.ok(matched.some((v:any)=>v.song_id===ids[62]));assert.equal(await scalar('select lyrics_text from public.songs where id=$1',[ids[0]]),null);
      const song=manifest.songs[0],args=[collection.id,song.number,song.title,song.fileName,song.sha256,song.previewSha256,song.firstLine];const f=await scalar(register,args);
      await db.exec('reset role');await db.query("insert into storage.objects(id,bucket_id,name) values(gen_random_uuid(),'song-files',$1)",[f.path]);await asUser(ADMIN);await assert.rejects(()=>scalar('select public.complete_presentation_v58($1)',[f.fileId]));
      await db.exec('reset role');await db.query("insert into storage.objects(id,bucket_id,name) values(gen_random_uuid(),'song-files',$1)",[f.previewPath]);await asUser(ADMIN);assert.equal((await scalar('select public.complete_presentation_v58($1)',[f.fileId])).complete,true);
      await db.query("update public.songs set title='Titlu editat local',lyrics_text='Versuri păstrate',default_key='F' where id=$1",[f.songId]);const kept=await scalar(register,args);assert.equal(kept.complete,true);assert.equal(await scalar('select title from public.songs where id=$1',[f.songId]),'Titlu editat local');assert.equal(await scalar('select default_key from public.songs where id=$1',[f.songId]),'F');assert.equal(await scalar('select lyrics_text from public.songs where id=$1',[f.songId]),'Versuri păstrate');
      args[5]=null;assert.equal((await scalar(register,args)).previewPath,f.previewPath);args[4]='a'.repeat(64);args[5]='b'.repeat(64);assert.equal((await scalar(register,args)).complete,false);
      await assert.rejects(()=>scalar(register,[collection.id,'900','Nevalid','../x.ppt','a'.repeat(64),null,null]));await assert.rejects(()=>scalar(register,[collection.id,'900','Nevalid','x.exe','a'.repeat(64),null,null]));
      const mid=await scalar("select public.create_meeting('Titlu fără versuri v58',null,now(),null)");const source=await scalar('select id from public.song_sources where song_id=$1 and collection_id=$2',[ids[62],collection.id]);await scalar('select public.add_program_song_v52($1,$2,$3,false,null,null)',[mid,ids[62],source]);assert.equal((await scalar('select public.get_meeting_snapshot_v46($1)',[mid])).items[0].song_id,ids[62]);
      await asUser(VIEWER);await assert.rejects(()=>scalar(register,args));await assert.rejects(()=>scalar('select public.complete_presentation_v58($1)',[f.fileId]));await asUser(INACTIVE);await assert.rejects(()=>scalar('select public.presentation_collection_v58()'));await asUser('','anon');await assert.rejects(()=>scalar('select public.presentation_collection_v58()'));await asUser(ADMIN);
      await assert.rejects(()=>scalar("select public.upsert_book_song_v57('cn','Parțial','001','Versuri suficiente pentru test','[]'::jsonb,'[]'::jsonb,'https://www.cantaricrestine.ro/test')"),/001–805/);await assert.rejects(()=>scalar("select public.finalize_book_catalog_v57('cn','[]',266)"));
      await db.query('delete from public.meetings where id=$1',[mid]);await db.query('delete from public.songs where id=any($1::uuid[])',[ids]);await db.query('delete from public.song_collections where id=$1',[collection.id]);
    });
    await t.test('v56 collection counts remain exact above 1000 source rows and match active library totals',async()=>{
      await asUser(ADMIN);const a=await scalar("insert into public.song_collections(name,short_code,source_type) values('Numărare A v56','CNT_A56','manual') returning id"),b=await scalar("insert into public.song_collections(name,short_code,source_type) values('Numărare B v56','CNT_B56','manual') returning id");
      await db.query("insert into public.song_sources(song_id,collection_id,song_number,source_title) select id,$1,row_number() over(order by title)::text,'test' from (select id,title from public.songs where title like 'Song %' order by title limit 601) x",[a]);
      await db.query("insert into public.song_sources(song_id,collection_id,song_number,source_title) select id,$1,row_number() over(order by title)::text,'test' from (select id,title from public.songs where title like 'Song %' order by title limit 700) x",[b]);
      await db.query("insert into public.song_sources(song_id,collection_id,source_title) select song_id,collection_id,'variantă suplimentară' from public.song_sources where collection_id=$1 limit 1",[a]);
      const counts=await scalar('select public.collection_song_counts_v56()');assert.equal(Number(counts.find((v:any)=>v.collection_id===a).song_count),601);assert.equal(Number(counts.find((v:any)=>v.collection_id===b).song_count),700);
      assert.equal(Number((await scalar('select public.list_song_library_v46(p_collection=>$1)',[a])).total),601);
      await asUser(VIEWER);assert.equal(Number((await scalar('select public.collection_song_counts_v56()')).find((v:any)=>v.collection_id===a).song_count),601);await asUser('','anon');await assert.rejects(()=>scalar('select public.collection_song_counts_v56()'));await asUser(ADMIN);await db.query('delete from public.song_collections where id=any($1::uuid[])',[[a,b]]);
    });
    await t.test('v56 recency/frequency sorts ignore future backup and template occurrences',async()=>{
      await asUser(ADMIN);const c=await scalar("insert into public.song_collections(name,short_code,source_type) values('Ordine v56','SORT_56','manual') returning id");const songs=[];for(let i=0;i<3;i++){const id=await scalar("insert into public.songs(title,created_at) values($1,now()-make_interval(days=>$2)) returning id",['Ordine v56 '+i,3-i]);songs.push(id);await db.query("insert into public.song_sources(song_id,collection_id,source_title) values($1,$2,'test')",[id,c]);}
      const meetings=[];for(let i=0;i<4;i++)meetings.push(await scalar("select public.create_meeting($1,null,now()+make_interval(days=>$2),null)",['Ordine v56 '+i,i===3?5:i-3]));
      for(const m of meetings.slice(0,2))await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[m,songs[0]]);
      for(let i=0;i<2;i++)await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[meetings[2],songs[1]]);
      await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[meetings[3],songs[2]]);await scalar('select public.add_song_to_meeting($1,$2,true,null,null)',[meetings[0],songs[2]]);
      const newest=await scalar("select public.list_song_library_v46(p_collection=>$1,p_sort=>'created_desc')",[c]);assert.equal(newest.songs[0].id,songs[2]);
      const recent=await scalar("select public.list_song_library_v46(p_collection=>$1,p_sort=>'last_sung')",[c]);assert.equal(Number(recent.total),2);assert.equal(recent.songs[0].id,songs[1]);
      const frequent=await scalar("select public.list_song_library_v46(p_collection=>$1,p_sort=>'most_sung')",[c]);assert.equal(frequent.songs[0].id,songs[0]);assert.equal(Number(frequent.songs[0].times_sung),2);
      await db.query('delete from public.meetings where id=any($1::uuid[])',[meetings]);await db.query('delete from public.songs where id=any($1::uuid[])',[songs]);await db.query('delete from public.song_collections where id=$1',[c]);
    });
    await t.test('v56 activity keeps readable titles after deletion and is admin-only',async()=>{
      await asUser(ADMIN);const id=await scalar("insert into public.songs(title,default_key) values('Jurnal lizibil v56','C') returning id");await db.query("update public.songs set default_key='F',lyrics_text='TEXT PRIVAT NECOPIAT' where id=$1",[id]);await db.query('delete from public.songs where id=$1',[id]);
      const result=await scalar("select public.activity_feed_v56(1,'changes',null)");const rows=result.entries.filter((v:any)=>v.resource_id===id);assert.equal(rows.length,3);assert.ok(rows.every((v:any)=>v.resource_label==='Jurnal lizibil v56'));assert.ok(!JSON.stringify(rows).includes('TEXT PRIVAT NECOPIAT'));assert.equal(rows.find((v:any)=>v.event_type==='update').details.after.default_key,'F');
      await asUser(VIEWER);await assert.rejects(()=>scalar("select public.activity_feed_v56(1,'changes',null)"));await asUser('','anon');await assert.rejects(()=>scalar("select public.activity_feed_v56(1,'changes',null)"));await asUser(ADMIN);
    });
    await t.test('v55 red book import preserves edits, maps aliases, resumes and isolates conflicts',async()=>{
      await asUser(ADMIN);await db.query("insert into public.song_collections(name,short_code,source_type,color) values('Cartea roșie - Cântările Evangheliei','CR_TEST_V55','manual','#b91c1c')");const destination=await scalar('select public.red_book_collection_v55()');
      assert.equal(destination.name,'Cartea roșie - Cântările Evangheliei');
      const params=['Un titlu unic de import v55','001','Versuri de test importate în siguranță',JSON.stringify([{section_type:'verse',section_label:'Strofa 1',content:'Versuri de test importate în siguranță'}]),JSON.stringify(['111','222']),'https://www.cantaricrestine.ro/test-import'];
      const sql='select public.import_red_book_song_v55($1,$2,$3,$4::jsonb,$5::jsonb,$6)';
      const first=await scalar(sql,params);assert.equal(first.status,'created');const sid=first.songId;
      await db.query("update public.songs set lyrics_text='Versuri editate local',default_key='F',notes='Observații locale' where id=$1",[sid]);
      const again=await scalar(sql,params);assert.equal(again.status,'existing');assert.equal(again.songId,sid);
      const songRow=(await db.query<any>('select * from public.songs where id=$1',[sid])).rows[0];assert.equal(songRow.lyrics_text,'Versuri editate local');assert.equal(songRow.default_key,'F');assert.equal(songRow.notes,'Observații locale');
      assert.equal(Number(await scalar('select count(*) from public.song_sources where collection_id=$1 and song_id=$2',[destination.id,sid])),1);
      assert.equal(Number(await scalar("select count(*) from public.song_link_imports where source_key in ('cantaricrestine:cr:111','cantaricrestine:cr:222')")),2);
      const conflict=await scalar(sql,['Alt titlu',...params.slice(1,4),JSON.stringify(['333']),params[5]]);assert.equal(conflict.status,'review');
      const missing=await scalar(sql,['Fără versuri v55','002','','[]',JSON.stringify(['444']),params[5]]);assert.equal(missing.status,'review');
      const variant=await scalar(sql,[params[0],'002','Versuri diferite pentru altă cântare din aceeași carte',params[3],JSON.stringify(['777']),params[5]]);assert.equal(variant.status,'created');assert.notEqual(variant.songId,sid);
      const existing=await scalar("insert into public.songs(title,lyrics_text,default_key) values('Existent v55','Text local existent','G') returning id");
      const linked=await scalar(sql,['Existent v55','003',params[2],params[3],JSON.stringify(['555']),params[5]]);assert.equal(linked.songId,existing);assert.equal(linked.status,'linked');assert.equal(await scalar('select default_key from public.songs where id=$1',[existing]),'G');
      const empty=await scalar("insert into public.songs(title) values('De completat v55') returning id");const filled=await scalar(sql,['De completat v55','004',params[2],params[3],JSON.stringify(['666']),params[5]]);assert.equal(filled.status,'filled');assert.equal(filled.songId,empty);
      for(const [id,role] of [[VIEWER,'authenticated'],[INACTIVE,'authenticated'],['','anon']]){await asUser(id,role);await assert.rejects(()=>scalar('select public.red_book_collection_v55()'));await assert.rejects(()=>scalar(sql,params));}
      await asUser('','service_role');assert.equal((await scalar(sql,params)).status,'existing');
      await asUser(ADMIN);await db.query('delete from public.songs where id=any($1::uuid[])',[[sid,existing,empty,variant.songId]]);await db.query('delete from public.song_collections where id=$1',[destination.id]);
    });
    await t.test('v63 deleting main-list songs during or after a program retracts history, backup never counts, and categories accumulate',async()=>{
      await asUser(ADMIN);const sid=await scalar("insert into public.songs(title) values('V63 current membership') returning id");
      const ongoing=await scalar("select public.create_meeting('V63 ongoing',null,now()-interval '1 hour',null)");const finished=await scalar("select public.create_meeting('V63 finished',null,now()-interval '3 hours',null)");const older=await scalar("select public.create_meeting('V63 older',null,now()-interval '2 days',null)");
      const currentItem=await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[ongoing,sid]);const endedItem=await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[finished,sid]);const olderItem=await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[older,sid]);
      await scalar('select public.add_song_to_meeting($1,$2,true,null,null)',[ongoing,sid]);await scalar('select public.add_song_to_meeting($1,$2,true,null,null)',[finished,sid]);
      const usage=async()=> (await db.query<any>('select * from public.get_song_recent_usage(30) where song_id=$1',[sid])).rows[0];assert.equal(Number((await usage()).times_used),3);
      await scalar('select public.remove_meeting_item($1,$2)',[ongoing,currentItem]);assert.equal(Number((await usage()).times_used),2);assert.equal((await usage()).last_meeting_title,'V63 finished');
      await scalar('select public.remove_meeting_item($1,$2)',[finished,endedItem]);assert.equal(Number((await usage()).times_used),1);assert.equal((await usage()).last_meeting_title,'V63 older');
      await scalar('select public.place_meeting_item_v45($1,$2,true,null)',[older,olderItem]);assert.equal(await usage(),undefined);const history=await scalar('select public.get_song_history_v46($1)',[sid]);assert.equal(Number(history.performed_total),0);assert.equal(history.last_used_at,null);
      const rows=await scalar("select public.list_song_library_v46(p_query=>'V63 current membership',p_sort=>'most_sung')");assert.equal(Number(rows.total),0);
      await scalar('select public.place_meeting_item_v45($1,$2,false,null)',[older,olderItem]);assert.equal(Number((await usage()).times_used),1);
      const categories=[];for(let n=0;n<3;n++){const c=await scalar("insert into public.categories(name,slug) values($1,$2) returning id",['V63 cat '+n,'v63-cat-'+n]);categories.push(c);await scalar('select public.assign_song_category_v62($1,$2)',[sid,c]);}await scalar('select public.assign_song_category_v62($1,$2)',[sid,categories[0]]);assert.equal(Number(await scalar('select count(*) from public.song_categories where song_id=$1',[sid])),3);
      await db.query('delete from public.meetings where id=any($1::uuid[])',[[ongoing,finished,older]]);await db.query('delete from public.songs where id=$1',[sid]);await db.query('delete from public.categories where id=any($1::uuid[])',[categories]);
    });
    await t.test('v62 structure, verse counts, scoped public metadata, category assignment and filters enforce active editor permissions',async()=>{
      await asUser(ADMIN);
      const song=await scalar("insert into public.songs(title,lyrics_text,default_key,structure) values('V62 Test Hymn','Prima strofă\n\nRefren','F','S1,R,S2,R') returning id");
      await db.query("insert into public.song_sections(song_id,position,section_type,section_label,content) values($1,1,'verse','Strofa 1','Prima strofă'),($1,2,'chorus','Refren','Un refren'),($1,3,'verse','Strofa 2','A doua strofă')",[song]);
      const details=await scalar('select public.song_details_v62($1)',[song]);assert.equal(details.verse_count,2);assert.equal(details.first_verse,'Prima strofă');assert.equal(details.chorus,'Un refren');
      const m=await scalar("select public.create_meeting('V62 program',null,now(),null)");const item=await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[m,song]);
      const payload={performance_structure:'s1, r, s2,r,r',verse_count:'2',responsible_name:'Ana',notes:'Test',selected_key:'G'};
      const snapshot=await scalar('select public.update_program_song_v62($1,$2,$3::jsonb)',[m,item,JSON.stringify(payload)]);assert.equal(snapshot.items[0].performance_structure,'S1,R,S2,R,R');assert.equal(snapshot.items[0].songs.verse_count,2);assert.equal(await scalar('select structure from public.songs where id=$1',[song]),'S1,R,S2,R');
      await assert.rejects(()=>scalar('select public.update_program_song_v62($1,$2,$3::jsonb)',[m,item,JSON.stringify({...payload,performance_structure:'BAD'})]));
      const copy=await scalar("select public.duplicate_meeting($1,'Copy v62',now())",[m]);assert.equal(await scalar('select performance_structure from public.meeting_items where meeting_id=$1',[copy]),'S1,R,S2,R,R');
      const cat=await scalar("insert into public.categories(name,slug) values('V62 Categorie','v62-categorie') returning id");
      await scalar('select public.assign_song_category_v62($1,$2)',[song,cat]);await scalar('select public.assign_song_category_v62($1,$2)',[song,cat]);assert.equal(Number(await scalar('select count(*) from public.song_categories where song_id=$1 and category_id=$2',[song,cat])),1);
      const results=await scalar("select public.search_program_songs_v62('V62 Test',30,null,null,$1,'F')",[cat]);assert.equal(results.length,1);assert.equal(results[0].verse_count,2);assert.equal(results[0].chorus,'Un refren');
      assert.equal((await scalar("select public.search_program_songs_v62('V62 Test',30,null,null,$1,'D')",[cat])).length,0);
      assert.equal((await scalar("select public.search_program_songs_v62('',30,null,null,$1,null)",[cat])).length,1);
      const slug=await scalar("select public.create_meeting_share_link($1,'v62-public')",[m]);
      for(const [id,role] of [[VIEWER,'authenticated'],[INACTIVE,'authenticated'],['','anon']]){await asUser(id,role);await assert.rejects(()=>scalar('select public.update_program_song_v62($1,$2,$3::jsonb)',[m,item,JSON.stringify(payload)]));await assert.rejects(()=>scalar('select public.assign_song_category_v62($1,$2)',[song,cat]));}
      await asUser('','anon');const shared=await scalar('select public.get_shared_meeting($1)',[slug]);assert.equal(shared.meeting.id,m);assert.equal(shared.items[0].id,item);assert.equal(shared.items[0].song.verse_count,2);assert.equal(shared.items[0].performance_structure,'S1,R,S2,R,R');await assert.rejects(()=>scalar('select public.song_details_v62($1)',[song]));assert.equal(await scalar("select public.get_shared_meeting('unknown-v62')"),null);
      await asUser(ADMIN);await db.query('delete from public.meetings where id=any($1::uuid[])',[[m,copy]]);await db.query('delete from public.songs where id=$1',[song]);await db.query('delete from public.categories where id=$1',[cat]);
    });
    await t.test('v59 anonymous proposals support all admin moment types and approval preserves type and backup',async()=>{
      await asUser(ADMIN);
      const m=await scalar("select public.create_meeting('Tipuri publice v59',null,now(),null)");
      const slug=await scalar("select public.create_meeting_share_link($1,'types-v59')",[m]);
      await db.query('update public.meeting_share_links set allow_contributions=true where meeting_id=$1',[m]);
      for(const kind of ['song','other','prayer','text','encouragement','message','break']){
        await asUser('','anon');
        const id=await scalar("select public.add_public_meeting_contribution($1,$2,null,'Moment propus','Observații',true,1,'Vizitator',null)",[slug,kind]);
        await assert.rejects(()=>scalar('select public.accept_public_meeting_contribution($1)',[id]));
        await asUser(ADMIN);
        const item=await scalar('select public.accept_public_meeting_contribution($1)',[id]);
        const row=(await db.query<any>('select * from public.meeting_items where id=$1',[item])).rows[0];
        assert.equal(row.moment_kind,kind);assert.equal(row.is_backup,true);assert.equal(row.custom_text,'Observații');assert.equal(row.song_id,null);
      }
      await asUser('','anon');await assert.rejects(()=>scalar("select public.add_public_meeting_contribution($1,'invalid',null,'Titlu')",[slug]));
      await asUser(ADMIN);await db.query('delete from public.meetings where id=$1',[m]);
    });
    await t.test('v54 approval uses global positions with backup, returns updated notifications and is idempotent',async()=>{
      await asUser(ADMIN);
      const song=await scalar("select id from public.songs where title like 'Song %' order by title limit 1");
      const m=await scalar("select public.create_meeting('Propuneri v54',null,now(),null)");
      const main=await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[m,song]);
      const backup=await scalar('select public.add_song_to_meeting($1,$2,true,null,null)',[m,song]);
      const proposal=await scalar("insert into public.public_meeting_contributions(meeting_id,contribution_type,custom_title,custom_text,is_backup,proposed_position,contributor_name,status) values($1,'prayer','Rugăciune propusă','Observații din propunere',false,1,'Vizitator','pending') returning id",[m]);
      // Reproduce the pre-v54 failure on the same mixed main/backup fixture.
      await db.exec('reset role');const old=fs.readFileSync(path.join(process.cwd(),'supabase','migrations','032_v38_public_share_polish.sql'),'utf8');
      await db.exec(old.slice(old.indexOf('create or replace function public.accept_public_meeting_contribution'),old.indexOf('grant execute on function public.accept_public_meeting_contribution')));
      await asUser(ADMIN);await assert.rejects(()=>scalar('select public.accept_public_meeting_contribution($1)',[proposal]),(e:any)=>e.code==='23505');
      await db.exec('reset role');await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V54.sql'),'utf8'));await asUser(ADMIN);
      assert.equal((await scalar('select public.program_notifications_v54($1)',[m])).length,1);
      const result=await scalar('select public.review_program_contribution_v54($1,$2,true)',[m,proposal]);
      assert.equal(result.pending.length,0);assert.equal(result.snapshot.items[0].custom_title,'Rugăciune propusă');assert.equal(result.snapshot.items[0].custom_text,'Observații din propunere');
      assert.deepEqual(result.snapshot.items.map((v:any)=>v.position),[1,2,3]);assert.equal(result.snapshot.items[1].id,main);assert.equal(result.snapshot.items[2].id,backup);
      const again=await scalar('select public.review_program_contribution_v54($1,$2,true)',[m,proposal]);assert.equal(again.snapshot.items.length,3);
      const second=await scalar("insert into public.public_meeting_contributions(meeting_id,contribution_type,song_id,is_backup,proposed_position,status) values($1,'song',$2,true,1,'pending') returning id",[m,song]);
      const accepted=await scalar('select public.review_program_contribution_v54($1,$2,true)',[m,second]);assert.equal(accepted.snapshot.items.filter((v:any)=>v.is_backup)[1].id,backup);
      const third=await scalar("insert into public.public_meeting_contributions(meeting_id,contribution_type,custom_title,status) values($1,'text','De respins','pending') returning id",[m]);
      const rejected=await scalar('select public.review_program_contribution_v54($1,$2,false)',[m,third]);assert.equal(rejected.pending.length,0);assert.equal(rejected.snapshot.items.length,4);
      await db.query('delete from public.meetings where id=$1',[m]);
    });
    await t.test('v54 fast common RPC validates scope, advances revision and denies viewers/anonymous/inactive',async()=>{
      await asUser(ADMIN);const song=await scalar("select id from public.songs where title like 'Song %' order by title limit 1");
      const m=await scalar("select public.create_meeting('Marcaj rapid v54',null,now(),null)");
      const other=await scalar("select public.create_meeting('Alt program v54',null,now(),null)");
      const item=await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[m,song]);
      const before=await scalar('select public.get_meeting_snapshot_v46($1)',[m]);const saved=await scalar('select public.set_program_common_v54($1,$2,true)',[m,item]);assert.equal(saved.items[0].is_congregational,true);assert.ok(saved.revision>before.revision);
      await assert.rejects(()=>scalar('select public.set_program_common_v54($1,$2,false)',[other,item]));
      const proposal=await scalar("insert into public.public_meeting_contributions(meeting_id,contribution_type,custom_title,status) values($1,'text','Test autorizare','pending') returning id",[m]);
      await assert.rejects(()=>scalar('select public.review_program_contribution_v54($1,$2,true)',[other,proposal]));
      for(const [id,role] of [[VIEWER,'authenticated'],[INACTIVE,'authenticated'],['','anon']]){await asUser(id,role);await assert.rejects(()=>scalar('select public.set_program_common_v54($1,$2,false)',[m,item]));await assert.rejects(()=>scalar('select public.program_notifications_v54($1)',[m]));await assert.rejects(()=>scalar('select public.review_program_contribution_v54($1,$2,true)',[m,proposal]));}
      await asUser(ADMIN);assert.equal((await scalar('select public.get_meeting_snapshot_v46($1)',[m])).items[0].is_congregational,true);
      await db.query('delete from public.meetings where id=any($1::uuid[])',[[m,other]]);
    });
    await t.test('v53 congregational marker is per program, copied/shared/audited and text moments cannot carry it',async()=>{
      await asUser(ADMIN);
      const song=await scalar("insert into public.songs(title) values('Cântare comună v53') returning id");
      const m=await scalar("insert into public.meetings(title,meeting_date,created_by) values('Program v53',now(),auth.uid()) returning id");
      const other=await scalar("insert into public.meetings(title,meeting_date,created_by) values('Alt program v53',now(),auth.uid()) returning id");
      const item=await scalar('select public.add_program_song_v52($1,$2,null,false,null,null)',[m,song]);
      const otherItem=await scalar('select public.add_program_song_v52($1,$2,null,false,null,null)',[other,song]);
      await db.query('update public.meeting_items set is_congregational=true where id=$1',[item]);
      assert.equal(await scalar('select is_congregational from public.meeting_items where id=$1',[otherItem]),false);
      const snapshot=await scalar('select public.get_meeting_snapshot_v46($1)',[m]);assert.equal(snapshot.items[0].is_congregational,true);
      const copy=await scalar("select public.duplicate_meeting($1,'Copie v53',now())",[m]);assert.equal(await scalar('select is_congregational from public.meeting_items where meeting_id=$1',[copy]),true);
      const audit=await scalar("select details from public.activity_log_v48 where resource_id=$1 and event_type='update' order by id desc limit 1",[item]);assert.equal(audit.after.is_congregational,true);
      const moment=await scalar("select public.add_text_to_meeting($1,'prayer','Rugăciune','Observații')",[m]);
      await db.query('update public.meeting_items set is_congregational=true where id=$1',[moment]);assert.equal(await scalar('select is_congregational from public.meeting_items where id=$1',[moment]),false);
      const slug=await scalar("select public.create_meeting_share_link($1,'comun-v53')",[m]);
      await asUser('','anon');const shared=await scalar('select public.get_shared_meeting($1)',[slug]);assert.equal(shared.items.find((v:any)=>v.is_congregational)?.song.title,'Cântare comună v53');
      await asUser(VIEWER);await db.query('update public.meeting_items set is_congregational=false where id=$1',[item]);
      await asUser(ADMIN);assert.equal(await scalar('select is_congregational from public.meeting_items where id=$1',[item]),true);
      await db.query('update public.meeting_items set is_congregational=false where id=$1',[item]);assert.equal((await scalar('select public.get_meeting_snapshot_v46($1)',[m])).items.find((v:any)=>v.id===item).is_congregational,false);
      await db.exec('reset role');await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V53.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V53.sql'),'utf8'));await asUser(ADMIN);
      await db.query('delete from public.meetings where id=any($1::uuid[])',[[m,other,copy]]);await db.query('delete from public.songs where id=$1',[song]);
    });
    await t.test('v52 search warns about another program on the same day and calendar deduplicates/plans past and future with exact Romanian dates',async()=>{
      await asUser(ADMIN);const song=await scalar("insert into public.songs(title,lyrics_text) values('Planificare v52','Versuri') returning id");
      const current=await scalar("select public.create_meeting('Dimineața',null,((now() at time zone 'Europe/Bucharest')::date+1+time '08:00') at time zone 'Europe/Bucharest',null)");
      const future=await scalar("select public.create_meeting('Seara',null,((now() at time zone 'Europe/Bucharest')::date+1+time '18:30') at time zone 'Europe/Bucharest',null)");
      const past=await scalar("select public.create_meeting('În trecut',null,now()-interval '20 days',null)");
      const template=await scalar("select public.create_meeting('Șablon ignorat',null,now()+interval '1 hour',null)");await db.query('update public.meetings set is_template=true where id=$1',[template]);
      for(const id of [current,future,past,template])await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[id,song]);
      await scalar('select public.add_song_to_meeting($1,$2,false,null,null)',[future,song]);
      const found=await scalar("select public.search_program_songs_v52('Planificare v52',8,$1)",[current]);assert.equal(found[0].schedule.next.meeting_id,future);assert.equal(found[0].schedule.last.meeting_id,past);
      assert.equal(await scalar("select to_char(meeting_date at time zone 'Europe/Bucharest','HH24:MI') from public.meetings where id=$1",[found[0].schedule.next.meeting_id]),'18:30');
      const date=await scalar("select (meeting_date at time zone 'Europe/Bucharest')::date::text from public.meetings where id=$1",[future]);
      const calendar=await scalar('select public.song_schedule_v52($1,$2,$3)',[song,date,current]);assert.equal(calendar.events.filter((e:any)=>e.meeting_id===future).length,1);assert.equal(calendar.events.find((e:any)=>e.meeting_id===future).day,date);assert.equal(Number(calendar.planned_count),1);assert.equal(Number(calendar.past_count),1);assert.ok(!calendar.events.some((e:any)=>e.meeting_id===current||e.meeting_id===template));
      await asUser(INACTIVE);await assert.rejects(()=>scalar('select public.song_schedule_v52($1,$2,$3)',[song,date,current]));await assert.rejects(()=>scalar("select public.search_program_songs_v52('Planificare',8,null)"));
      await asUser('','anon');await assert.rejects(()=>scalar('select public.song_schedule_v52($1,$2,$3)',[song,date,current]));await assert.rejects(()=>scalar("select public.search_program_songs_v52('Planificare',8,null)"));
      await asUser(ADMIN);await db.query('delete from public.meetings where id=any($1::uuid[])',[[current,future,past,template]]);await db.query('delete from public.songs where id=$1',[song]);
    });
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
      const slug=await scalar("select public.create_meeting_share_link_v66($1,'v48-public',false)",[id]);
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
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V42.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V43.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V44.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V45.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V45.sql'),'utf8')); // rerun safe
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V46.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V46.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V47.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V47.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V48.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V48.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V49.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V49.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V52.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V52.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V53.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V54.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V54.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V55.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V55.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V56.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(process.cwd(),'supabase','updates','UPDATE-V56.sql'),'utf8'));
      await db.exec(fs.readFileSync('supabase/updates/UPDATE-V57.sql','utf8'));
      await db.exec(fs.readFileSync('supabase/updates/UPDATE-V57.sql','utf8'));
      await db.exec(fs.readFileSync('supabase/updates/UPDATE-V58.sql','utf8'));
      await db.exec(fs.readFileSync('supabase/updates/UPDATE-V58.sql','utf8'));
      await db.exec(fs.readFileSync('supabase/updates/UPDATE-V65.sql','utf8'));
      await db.exec(fs.readFileSync('supabase/updates/UPDATE-V65.sql','utf8'));
      const fresh = new PGlite({ extensions: { pg_trgm, unaccent, pgcrypto } });
      try {
        await fresh.exec(setup);
        await fresh.exec(fs.readFileSync(path.join(process.cwd(),'supabase','setup','INSTALL-NEW.sql'),'utf8'));
        assert.equal((await fresh.query<{n:number}>('select count(*)::integer as n from public.songs')).rows[0].n,0);
      } finally { await fresh.close(); }
    });
  } finally { await db.close(); }
});
