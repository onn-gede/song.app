import test from "node:test";
import assert from "node:assert/strict";
import { buildFreeShow, parseFreeShow, safeFreeShowFileName } from "../lib/freeshow";

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
