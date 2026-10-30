import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {hash,readPackage,programDocument,type PackageData} from '../lib/backup-package.js';
async function fixture(mutate?:(zip:JSZip,manifest:any,data:PackageData)=>void){
 const zip=new JSZip(),bytes=new TextEncoder().encode('%PDF-test'),sha=await hash(bytes),entry=`files/${sha}.pdf`;
 const data:PackageData={format:'songapp-package',version:64,kind:'backup',createdAt:new Date().toISOString(),tables:{song_files:[{id:'file1',storage_path:'original/test.pdf'}]}};
 const text=JSON.stringify(data),manifest={format:data.format,version:64,kind:data.kind,createdAt:data.createdAt,dataHash:await hash(new TextEncoder().encode(text)),attachments:[{path:'original/test.pdf',entry,sha256:sha,size:bytes.length,mime:'application/pdf'}]};
 zip.file('data.json',text);zip.file(entry,bytes);mutate?.(zip,manifest,data);zip.file('manifest.json',JSON.stringify(manifest));return new File([new Uint8Array(await zip.generateAsync({type:'uint8array'}))],'backup.zip');
}
test('v64 ZIP integrity validates content, maps files without overwrites, rejects tampering and missing attachments',async()=>{
 const loaded=await readPackage(await fixture());assert.match(loaded.tables.song_files[0].storage_path,/^restored-v64\/[a-f0-9]{64}\.pdf$/);assert.equal(loaded.data.tables.song_files[0].storage_path,'original/test.pdf');
 await assert.rejects(async()=>readPackage(await fixture(z=>z.file('data.json','{}'))),/deteriorate/);
 await assert.rejects(async()=>readPackage(await fixture((z,m)=>z.remove(m.attachments[0].entry))),/lipsă/);
 await assert.rejects(async()=>readPackage(await fixture((z,m)=>z.file(m.attachments[0].entry,'corrupt'))),/deteriorat/);
 await assert.rejects(async()=>readPackage(await fixture((_z,m)=>{m.attachments=[];})),/incomplet/);
 await assert.rejects(async()=>readPackage(await fixture((_z,m)=>m.attachments.push(m.attachments[0]))),/invalid/);
 await assert.rejects(async()=>readPackage(await fixture(z=>z.file('../escape.txt','unsafe'))),/Cale ZIP invalidă/);
});
test('v64 offline program preserves order, backup, team and escapes imported text',()=>{
 const d:PackageData={format:'songapp-package',version:64,kind:'program',createdAt:'2026-10-29',tables:{meetings:[{title:'<script>alert(1)</script>',meeting_date:'2026-10-29T16:30:00Z',principal_responsible:'Filip',secondary_responsibles:['Ana']}],songs:[{id:'s',title:'Cântare'}],meeting_items:[{position:2,is_backup:true,custom_title:'Rezervă test'},{position:1,song_id:'s',responsible_name:'Maria',notes:'Observații'}]}};
 const html=programDocument(d,[]);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/Filip/);assert.match(html,/Maria/);assert.match(html,/Observații/);assert.ok(html.indexOf('Cântare')<html.indexOf('Rezervă test'));
});
