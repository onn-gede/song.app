import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import {validatePresentationManifest,validatePresentationAssets} from '../scripts/black-ppt-lib.mjs';
test('v58 all 803 original PPT files and PDF previews match the attached archive without missing numbers',async()=>{const m=JSON.parse(await fs.readFile('data/black-book-ppt.json'));assert.deepEqual(validatePresentationManifest(m),{count:803,min:1,max:803});assert.deepEqual(m.songs.map(s=>Number(s.number)),Array.from({length:803},(_,i)=>i+1));const bytes=await fs.readFile('local-assets/black-book/originals.zip');const ready=await validatePresentationAssets(m,bytes,await JSZip.loadAsync(bytes),f=>fs.readFile(f));assert.equal(ready.length,803);assert.ok(ready.every(r=>r.preview.length>1000));});
