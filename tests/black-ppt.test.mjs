import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import {validatePresentationManifest,validatePresentationAssets,sha256} from '../scripts/black-ppt-lib.mjs';
test('v58 manifest contains exactly 803 titles with every number from 001 to 803',async()=>{const m=JSON.parse(await fs.readFile('data/black-book-ppt.json'));assert.deepEqual(validatePresentationManifest(m),{count:803,min:1,max:803});assert.deepEqual(m.songs.map(s=>Number(s.number)),Array.from({length:803},(_,i)=>i+1));});
test('v58 refuses mismatched archives, missing title entries and duplicated numbers before any database connection',async()=>{const m=JSON.parse(await fs.readFile('data/black-book-ppt.json'));assert.throws(()=>validatePresentationManifest({...m,songs:m.songs.slice(1)}));const bad=structuredClone(m);bad.songs[1].number=bad.songs[0].number;assert.throws(()=>validatePresentationManifest(bad));await assert.rejects(()=>validatePresentationAssets(m,Buffer.from('wrong'),null,()=>{}),/Arhiva PPT/);});

test('PPT validation accepts a matching fixture and rejects altered original, preview and missing entry without local assets',async()=>{
 const original=Buffer.from('PPT fixture'),preview=Buffer.from('%PDF-1.7 fixture');
 const zip=new JSZip();zip.file('001 Titlu.ppt',original);const archive=await zip.generateAsync({type:'nodebuffer'});
 const m={schema:1,count:1,archiveSha256:sha256(archive),songs:[{number:'001',title:'Titlu',fileName:'001 Titlu.ppt',bytes:original.length,sha256:sha256(original),preview:'local-assets/black-book/previews/001.pdf',previewSha256:sha256(preview)}]};
 const parsed=await JSZip.loadAsync(archive);assert.equal((await validatePresentationAssets(m,archive,parsed,async()=>preview)).length,1);
 await assert.rejects(()=>validatePresentationAssets(m,archive,parsed,async()=>Buffer.from('%PDF-corrupt')),/modificat/);
 const changed=await JSZip.loadAsync(archive);changed.file('001 Titlu.ppt',Buffer.from('altered'));await assert.rejects(()=>validatePresentationAssets(m,archive,changed,async()=>preview),/modificat/);
 const missing=new JSZip();missing.file('002 Other.ppt',original);await assert.rejects(()=>validatePresentationAssets(m,archive,missing,async()=>preview),/Lipsește/);
});
