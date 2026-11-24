import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSectionLabel,
  lyricsFromStructuredSections,
  splitSectionText,
  structureFromSections,
} from "../lib/section-editor";

test("import section helpers number verses, preserve named types and split blank-line blocks", () => {
  assert.equal(defaultSectionLabel("verse", 3), "Strofa 3");
  assert.equal(defaultSectionLabel("chorus", 9), "Refren");
  assert.equal(defaultSectionLabel("bridge", 2), "Bridge");
  const chunks = splitSectionText("Linia unu\nLinia doi\n\nLinia trei\nLinia patru");
  assert.deepEqual(chunks, ["Linia unu\nLinia doi", "Linia trei\nLinia patru"]);
  const sections = [
    { section_type: "verse", section_label: "Strofa 1", position: 1, content: chunks[0] },
    { section_type: "chorus", section_label: "Refren", position: 2, content: "Refren text" },
    { section_type: "verse", section_label: "Strofa 2", position: 3, content: chunks[1] },
    { section_type: "bridge", section_label: "Bridge 2", position: 4, content: "Bridge text" },
  ];
  assert.equal(structureFromSections(sections), "S1, R, S2, B");
  assert.equal(
    structureFromSections([
      { section_type: "verse", section_label: "Strofa 1" },
      { section_type: "verse", section_label: "Strofa 1" },
      { section_type: "verse", section_label: "Strofa 2" },
    ]),
    "S1, S1, S2",
  );
  assert.equal(
    lyricsFromStructuredSections(sections),
    "Linia unu\nLinia doi\n\nRefren text\n\nLinia trei\nLinia patru\n\nBridge text",
  );
});
