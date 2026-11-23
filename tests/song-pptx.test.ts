import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { buildSongPptx, pptxLineWidth, prepareSongPptxSlides, safeSongPptxFileName, validatePreparedSongPptxSlides } from "../lib/song-pptx";

test("PowerPoint export uses numbered filename and splits long sections", () => {
  assert.equal(safeSongPptxFileName("Harul Tău: cântarea / mea", "510"), "510. Harul Tău cântarea mea.pptx");
  const slides = prepareSongPptxSlides([{ section_type: "chorus", content: "Unu\nDoi\nTrei\nPatru\nCinci\nȘase\nȘapte" }]);
  assert.equal(slides.length, 2);
  assert.equal(slides[0].label, "R.");
  assert.equal(slides[0].italic, false);
  assert.deepEqual(slides.map((slide) => slide.lines.length), [4, 3]);
  assert.deepEqual(validatePreparedSongPptxSlides(slides), []);
});

test("PowerPoint export balances every long section instead of leaving one orphan line", () => {
  const lines = (count: number) => Array.from({ length: count }, (_, index) => `Linia ${index + 1}`).join("\n");
  assert.deepEqual(prepareSongPptxSlides([{ content: lines(8) }]).map((slide) => slide.lines.length), [4, 4]);
  assert.deepEqual(prepareSongPptxSlides([{ content: lines(11) }]).map((slide) => slide.lines.length), [6, 5]);
  assert.deepEqual(prepareSongPptxSlides([{ content: lines(13) }]).map((slide) => slide.lines.length), [5, 4, 4]);
});

test("PowerPoint export wraps wide text and unbroken words inside the safe image area", () => {
  const slides = prepareSongPptxSlides([{ section_type: "verse", content: "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW\nAcesta este un rând românesc foarte lung care trebuie încadrat înainte de exportul final" }]);
  assert.ok(slides.length >= 1);
  assert.deepEqual(validatePreparedSongPptxSlides(slides), []);
  assert.ok(slides.every((slide) => slide.lines.length <= 6));
  assert.ok(slides.flatMap((slide) => slide.lines).every((line) => pptxLineWidth(line) <= 28.01));
});

test("PowerPoint export preserves the supplied design master and creates one slide per section", async () => {
  const template = fs.readFileSync(path.join(process.cwd(), "public", "templates", "songapp-song-template.pptx"));
  const result = await buildSongPptx(template, {
    title: "Cântarea de test",
    number: "510",
    sections: [
      { section_type: "verse", section_label: "Strofa 1", content: "Prima linie\nA doua linie" },
      { section_type: "chorus", section_label: "Refren", content: "Textul refrenului" },
    ],
  });
  const zip = await JSZip.loadAsync(result);
  assert.ok(zip.file("ppt/slideMasters/slideMaster1.xml"));
  assert.ok(zip.file("ppt/slides/slide1.xml"));
  assert.ok(zip.file("ppt/slides/slide2.xml"));
  assert.equal(zip.file("ppt/slides/slide3.xml"), null);
  const slide1 = await zip.file("ppt/slides/slide1.xml")!.async("string");
  const slide2 = await zip.file("ppt/slides/slide2.xml")!.async("string");
  assert.match(slide1, /Cântarea de test/);
  assert.match(slide1, />510</);
  assert.match(slide1, /Prima linie/);
  assert.match(slide2, /Textul refrenului/);
  assert.doesNotMatch(slide2, /sz="4600"[^>]*i="1"/);
});
