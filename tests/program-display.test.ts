import {test} from 'node:test';
import assert from 'node:assert/strict';
import {songProgramMetadata,programMomentLabels} from '../lib/program-display';
import {buildProgramSlides} from '../lib/presentation';

test('shared program metadata preserves explicit collection, program overrides, unknown and zero verse counts',()=>{
 const sources=[{source_id:'a',collection_id:'one',name:'Tineri',number:'063',color:'#2563eb'},{source_id:'b',collection_id:'two',name:'Roșie',number:'004',color:'#9f1239'}];
 const song={default_key:' F ',bpm:80,verse_count:0,structure:'S1,R'};
 const meta=songProgramMetadata({sources,selected_source_id:'b',selected_key:' G ',selected_bpm:90,performance_structure:'R,S1',is_congregational:true},song);
 assert.equal(meta.source,sources[1]);assert.equal(meta.musicalKey,'G');assert.equal(meta.bpm,90);assert.equal(meta.verseCount,0);assert.equal(meta.structure,'R,S1');assert.equal(meta.isCongregational,true);
 const defaults=songProgramMetadata({selected_key:'  '},{...song,verse_count:null});assert.equal(defaults.musicalKey,'F');assert.equal(defaults.verseCount,null);assert.equal(defaults.structure,'S1,R');assert.equal(defaults.bpm,80);
 const moment=songProgramMetadata({sources,is_congregational:true,selected_key:'G'},null);assert.equal(moment.source,null);assert.equal(moment.musicalKey,undefined);assert.equal(moment.bpm,null);assert.equal(moment.isCongregational,false);
 assert.equal(programMomentLabels.other,'Diverse');
});

test('program slides agree with list/print resolver without counting repeated refrains as verses',()=>{
 const song={title:'Titlu',default_key:'F',lyrics_text:'Versuri',structure:'S1,R',song_sections:[{id:'1',position:1,section_label:'S1',section_type:'verse',content:'Strofa'},{id:'2',position:2,section_label:'R',section_type:'chorus',content:'Refren'}]};
 const item={id:'i',position:1,is_backup:false,custom_title:null,custom_text:null,item_type:'song',selected_key:'G',performance_structure:'S1,R,R',songs:song,is_congregational:true};
 const slides=buildProgramSlides([item]);assert.equal(slides.length,3);
 const metadata=songProgramMetadata(item,{...song,verse_count:1});
 for(const slide of slides){assert.equal(slide.musicalKey,metadata.musicalKey);assert.equal(slide.structure,metadata.structure);assert.equal(slide.verseCount,metadata.verseCount);assert.equal(slide.isCongregational,metadata.isCongregational);}
});
