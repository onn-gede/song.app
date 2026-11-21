import test from "node:test";
import assert from "node:assert/strict";
import { buildFreeShow, parseFreeShow, safeFreeShowFileName } from "../lib/freeshow";
import {buildFreeShowCreateData,createdFreeShowId,findFreeShowByName,findFreeShowMatches,findFreeShowProject,freeShowProjectItemCount,normalizeFreeShowLocalUrl} from "../lib/freeshow-local";
import {buildFreeShowProgramPayload,formatFreeShowProgramDate} from "../lib/freeshow-program";

test("FreeShow export preserves title, order, groups and lyrics", () => {
  const show = buildFreeShow("Harul Tău", [{label:"Strofa 1",content:"Linia unu\nLinia doi"},{label:"Refren",content:"Refrenul meu"}], {number:"063",key:"G"});
  const parsed = parseFreeShow(show);
  assert.equal(parsed.title,"Harul Tău");
  assert.equal(parsed.songNumber,"063");
  assert.equal(parsed.defaultKey,"G");
  assert.deepEqual(parsed.sections.map(section=>section.label),["Strofa 1","Refren"]);
  assert.deepEqual(parsed.sections.map(section=>section.content),["Linia unu\nLinia doi","Refrenul meu"]);
  assert.equal(parsed.structure,"S,R");
});

test("FreeShow import follows active layout and child slide order", () => {
  const show:any=buildFreeShow("Test",[{label:"Verse 1",content:"A"},{label:"Chorus",content:"B"}]);
  show.slides["songapp-slide-1"].children=["songapp-slide-2"];
  show.layouts["songapp-layout"].slides=[{id:"songapp-slide-1"}];
  const parsed=parseFreeShow(JSON.stringify(show));
  assert.deepEqual(parsed.sections.map(section=>section.content),["A","B"]);
});

test("FreeShow rejects empty shows and creates safe filenames", () => {
  assert.throws(()=>parseFreeShow({slides:{}}),/slide-uri/);
  assert.equal(safeFreeShowFileName("Cântarea: mea / test"),"Cantarea mea test.show");
});

test("FreeShow local accepts only loopback addresses and finds existing shows",()=>{
  assert.equal(normalizeFreeShowLocalUrl("http://127.0.0.1:5510/freeshow/"),"http://127.0.0.1:5510/freeshow");
  assert.equal(normalizeFreeShowLocalUrl("http://localhost:5506/"),"http://localhost:5506");
  assert.equal(normalizeFreeShowLocalUrl("http://127.0.0.1:5506"),"http://127.0.0.1:5506");
  assert.throws(()=>normalizeFreeShowLocalUrl("https://example.com"),/http:\/\//);
  assert.throws(()=>normalizeFreeShowLocalUrl("http://192.168.1.10:5506"),/acest calculator/);
  assert.deepEqual(findFreeShowByName({data:{abc:{name:"SongApp · Joi"}}},"songapp · joi"),{id:"abc",name:"SongApp · Joi"});
  assert.deepEqual(buildFreeShowCreateData("Program joi","Strofa 1\nText"),{
    name:"Program joi",text:"Strofa 1\nText",category:"SongApp",open:true,
  });
  assert.deepEqual(findFreeShowMatches({data:{abc:{name:"Harul Tău"},def:{name:"Harul Tău",origin:"songapp-song:s1"}}},"Harul Tău","songapp-song:s1"),[
    {id:"def",name:"Harul Tău",origin:"songapp-song:s1"},{id:"abc",name:"Harul Tău"},
  ]);
  assert.equal(createdFreeShowId({data:{id:"new-show",show:{name:"Nou"}}}),"new-show");
  assert.deepEqual(findFreeShowProject({data:{p1:{name:"SongApp · Joi",shows:[{id:"s1"}]}}},"p1","Alt nume"),{id:"p1",name:"SongApp · Joi",shows:[{id:"s1"}]});
  assert.equal(freeShowProjectItemCount({data:{name:"Joi",shows:[{id:"s1"},{id:"s2"}]}}),2);
});

test("FreeShow program sends distinct items with lyrics only",()=>{
  const payload=buildFreeShowProgramPayload("meeting-1","Joi","2026-11-29T18:30:00+02:00",[
    {id:"one",song:{id:"s1",title:"Harul Tău",lyrics_text:null,song_sections:[
      {section_label:"Strofa 1",position:1,content:"Primul vers\nAl doilea vers"},
      {section_label:"Refren",position:2,content:"Textul refrenului"},
    ]}},
    {id:"two",song:{id:"s2",title:"A doua cântare",lyrics_text:"Linia A\nLinia B\n\nLinia C",song_sections:[]}},
    {id:"three",custom_title:"Rugăciune",custom_text:"Text pentru moment"},
  ]);
  assert.equal(payload.item_count,3);
  assert.equal(payload.slide_count,5);
  assert.equal(payload.project_id,"songapp-meeting-1");
  assert.equal(payload.project_name,"SongApp · Joi · 29.11.2026 · 18:30");
  assert.equal(formatFreeShowProgramDate("2026-11-29T18:30:00+02:00"),"29.11.2026 · 18:30");
  assert.deepEqual(payload.items.map(item=>item.name),["Harul Tău","A doua cântare","Rugăciune"]);
  assert.deepEqual(payload.items.map(item=>item.source_key),["songapp-song:s1","songapp-song:s2","songapp-meeting-item:three"]);
  assert.equal(payload.items[0].text,"Primul vers\nAl doilea vers\n\nTextul refrenului");
  assert.equal(payload.items[0].text.includes("Strofa 1"),false);
  assert.equal(payload.items[0].text.includes("Refren"),false);
  assert.equal(payload.items[0].text.includes("Harul Tău"),false);
  assert.deepEqual(buildFreeShowCreateData("Harul Tău",payload.items[0].text,false,payload.items[0].source_key),{
    name:"Harul Tău",text:"Primul vers\nAl doilea vers\n\nTextul refrenului",category:"SongApp",open:false,origin:"songapp-song:s1",
  });
});
