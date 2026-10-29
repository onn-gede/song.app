import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupCatalog,numberedTitle,sectionsFromLyrics,pptTextAtoms,sourceUrl} from '../scripts/red-book-import-lib.mjs';
const row=(id,denumire,descriere)=>({id,denumire,descriere,categoria_simbol:'cr'});
test('red book groups numbered and unnumbered variants while resolving ambiguous titles by exact lyrics',()=>{
 const {groups,review}=groupCatalog([row('1','001 - Un titlu','Primul text unic'),row('2','002 Un titlu','Al doilea text unic'),row('3','Un titlu','Al doilea text unic'),row('4','Titlu scris altfel','Primul text unic')]);
 assert.equal(groups.length,2);assert.equal(review.length,0);assert.deepEqual(groups.map(v=>v.rows.map(r=>r.id)),[['1','4'],['2','3']]);assert.deepEqual(numberedTitle('019 - Cânt Aleluia'),{number:'019',title:'Cânt Aleluia'});
});
test('red book refuses duplicate numbers, overlapping ids and foreign categories',()=>{
 assert.throws(()=>groupCatalog([row('1','001 Titlu',''),row('2','001 Altul','')]));assert.throws(()=>groupCatalog([row('1','001 Titlu',''),row('1','Titlu','')]));assert.throws(()=>groupCatalog([{...row('1','001 Titlu',''),categoria_simbol:'cn'}]));
});
test('red book keeps uncertain unnumbered entries for review',()=>{const result=groupCatalog([row('1','001 Un titlu',''),row('2','Altă cântare','')]);assert.equal(result.review.length,1);assert.equal(result.groups[0].rows.length,1);});
test('red book stanza parser preserves repeated lines and identifies refrains',()=>{const s=sectionsFromLyrics('1. Prima linie\nPrima linie\n\nR: Un refren\n\n2. A doua strofă');assert.equal(s.length,3);assert.equal(s[0].content,'Prima linie\nPrima linie');assert.equal(s[1].section_type,'chorus');assert.equal(s[2].section_label,'Strofa 2');assert.deepEqual(sectionsFromLyrics('Prima strofă\n\nA doua strofă').map(v=>v.section_label),['Strofa 1','Strofa 2']);});
test('red book PPT reader extracts valid Unicode text atoms and ignores unrelated records',()=>{const t=Buffer.from('Text cu ș și ț','utf16le'),record=Buffer.alloc(8+t.length);record.writeUInt16LE(4000,2);record.writeUInt32LE(t.length,4);t.copy(record,8);assert.deepEqual(pptTextAtoms(record),['Text cu ș și ț']);const malformed=Buffer.from(record);malformed.writeUInt32LE(999999,4);assert.deepEqual(pptTextAtoms(malformed),[]);});
test('red book file downloads stay on the source host and cr path',()=>{assert.ok(sourceUrl('https://www.cantaricrestine.ro/cantari/cr/Test.ppt',true));assert.throws(()=>sourceUrl('https://127.0.0.1/a',true));assert.throws(()=>sourceUrl('https://www.cantaricrestine.ro/cantari/cn/Test.ppt',true));assert.throws(()=>sourceUrl('https://www.cantaricrestine.ro@localhost/test',true));});
test('v57 verified book payloads keep all 601 red hymns and strip the obsolete PowerPoint template',async()=>{
 const fs=await import('node:fs/promises');for(const code of ['cr','cn']){const d=JSON.parse(await fs.readFile(`data/book-catalogs/${code}.json`));assert.equal(d.songs.length,code==='cr'?601:266);assert.equal(new Set(d.songs.flatMap(x=>x.sourceIds)).size,code==='cr'?1200:482);assert.ok(d.songs.every(x=>!x.error&&x.lyrics.length>=20&&x.sections.length));}
 const d=JSON.parse(await fs.readFile('data/book-catalogs/cr.json'));const hymn=d.songs.find(x=>x.number==='012');assert.ok(hymn.sections[0].content.startsWith('Totul Te adoră-n lume'));assert.equal(hymn.sections.length,5);assert.ok(!hymn.lyrics.includes('O, ce valuri'));assert.ok(!hymn.lyrics.includes('012'));
});
