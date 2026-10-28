import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSourceUrl, extractLinks, parseResurseSong } from "../lib/external-sync/parser";
import { processNextSyncUnit } from "../lib/external-sync/worker";
import { buildProgramSlides, type PresentationItem } from "../lib/presentation";
import { libraryPage, libraryHref } from "../lib/library";

const songHtml='<h1>Cântare de test</h1><p>1. Prima linie pentru testul cântării</p><p>A doua linie pentru test</p><p>Resurse înrudite</p><p>Nu importa acest text</p>';
test('source URL boundaries and extraction reject misleading domains',()=>{
  for(const url of ['https://evil.resursecrestine.ro/cantece/1/a','https://resursecrestine.ro.evil.org/cantece/1/a','http://www.resursecrestine.ro/','https://user:pass@www.resursecrestine.ro/','https://www.resursecrestine.ro:8443/']) assert.throws(()=>assertSourceUrl(url));
  const links=extractLinks('<a href="/cantece/123/test">Test</a><a href="https://resursecrestine.ro.evil.org/cantece/9/x">Attack</a><a href="/cantece/123/test">Again</a>', 'https://www.resursecrestine.ro','resursecrestine');
  assert.equal(links.length,1);
  const song=parseResurseSong(songHtml,links[0].url);
  assert.ok(song?.lyrics.includes('Prima linie'));
  assert.ok(!song?.lyrics.includes('Nu importa'));
});
test('program presentation sorts sections and keeps repeated songs distinct',()=>{
  const makeSong=(id:string,position:number,is_backup=false):PresentationItem=>({id,position,is_backup,item_type:'song',custom_title:null,custom_text:null,songs:{title:'Cântare',lyrics_text:null,song_sections:[{id:'s2',position:2,section_type:'chorus',section_label:'Refren',content:'Refren text'},{id:'s1',position:1,section_type:'verse',section_label:'Strofa 1',content:'Cântare\nStrofa text'}]}});
  const items=[makeSong('repeat',3),makeSong('backup',900,true),makeSong('first',1),{id:'prayer',position:2,is_backup:false,item_type:'prayer',custom_title:'Rugăciune',custom_text:null,songs:null}];
  const slides=buildProgramSlides(items);
  assert.equal(slides.length,5);assert.equal(slides[0].content,'Strofa text');assert.equal(slides[2].content,'Rugăciune');
  assert.equal(new Set(slides.map(s=>s.id)).size,5);
  assert.equal(buildProgramSlides(items,true).length,7);
});
test('pagination keeps filters and rejects malformed page values',()=>{
  assert.equal(libraryPage('NaN'),1);assert.equal(libraryPage('-4'),1);assert.equal(libraryPage('2.5'),1);
  const url=new URL(libraryHref({q:'har',category:'a',sort:'created_desc',deleted:'2'},3),'http://localhost');
  assert.equal(url.searchParams.get('q'),'har');assert.equal(url.searchParams.get('category'),'a');assert.equal(url.searchParams.get('page'),'3');assert.ok(!url.searchParams.has('deleted'));
});
function fakeClient(job: unknown) {
  const calls: Array<{ name: string; args: any }> = [];
  const client={rpc:async(name:string,args:any)=>{calls.push({name,args});return {data:name==='claim_external_sync'?job:true,error:null};}} as unknown as SupabaseClient;
  return { client, calls };
}
test('worker commits fetch errors to one item without aborting remaining songs',async()=>{
  const {client,calls}=fakeClient({id:'run',lease_token:'token',pages_scanned:1,found_count:2,next_index:0,discovered_links:[{url:'https://www.resursecrestine.ro/cantece/1/a'}],options:{pages:1,maxSongs:25,overwrite:false}});
  assert.equal(await processNextSyncUnit(client,{fetchHtml:async()=>{throw new Error('HTTP 503');}}),true);
  assert.equal(calls[1].name,'commit_external_sync_song');assert.equal(calls[1].args.p_error,'HTTP 503');assert.equal(calls[1].args.p_song,null);
});
test('worker discovery checkpoints one page and does no detached work',async()=>{
  const {client,calls}=fakeClient({id:'run',lease_token:'token',pages_scanned:0,found_count:0,next_index:0,discovered_links:[],options:{pages:2,maxSongs:25,overwrite:false}});
  await processNextSyncUnit(client,{fetchHtml:async()=>'<a href="/cantece/123/test">Test</a>'});
  assert.equal(calls.length,2);assert.equal(calls[1].name,'checkpoint_external_scan');assert.equal(calls[1].args.p_page,1);assert.equal(calls[1].args.p_links.length,1);
});
test('worker records scan failures explicitly and can stay idle',async()=>{
  const {client,calls}=fakeClient({id:'run',lease_token:'token',pages_scanned:0,options:{pages:1}});
  await processNextSyncUnit(client,{fetchHtml:async()=>{throw new Error('Scan failed');}});
  assert.equal(calls[1].name,'fail_external_sync');
  const idle=fakeClient(null);assert.equal(await processNextSyncUnit(idle.client),false);
});

test('v46 committed program state wins over stale route props, while newer versions win', async () => {
  const { latestMeetingSnapshot } = await import('../lib/meeting-state.js');
  const empty={revision:0,principal:null,secondary:[],items:[]};
  const saved={...empty,revision:2,principal:'Filip',secondary:['Ana']};
  assert.equal(latestMeetingSnapshot(empty,saved).principal,'Filip');
  assert.deepEqual(latestMeetingSnapshot(empty,saved).secondary,['Ana']);
  assert.equal(latestMeetingSnapshot({...saved,revision:3,principal:'Emanuel'},saved).principal,'Emanuel');
  assert.equal(latestMeetingSnapshot(saved,null),saved);
});
test('v46 program completion uses Bucharest calendar day and handles daylight saving boundaries', async () => {
  const { meetingStatus,bucharestDayStart } = await import('../lib/meeting-state.js');
  const now=new Date('2026-10-28T08:00:00Z');
  assert.equal(meetingStatus('2026-10-27T18:00Z','draft',false,now),'finished');
  assert.equal(meetingStatus('2026-10-28T07:00Z','draft',false,now),'draft');
  assert.equal(meetingStatus('2026-10-27T23:00Z','ready',false,now),'ready'); // midnight in Bucharest
  assert.equal(meetingStatus('2026-10-27T10:00Z','draft',true,now),'template');
  assert.equal(meetingStatus('2026-10-27T10:00Z','archived',false,now),'archived');
  assert.equal(bucharestDayStart(new Date('2026-03-29T12:00Z')),'2026-03-28T22:00:00.000Z');
  assert.equal(bucharestDayStart(new Date('2026-10-25T12:00Z')),'2026-10-24T21:00:00.000Z');
});
