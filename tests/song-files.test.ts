import test from "node:test";
import assert from "node:assert/strict";
import { canCheckStoredPowerPoint, isPowerPointFile, storageObjectTarget } from "../lib/song-files";

test("only real PowerPoint storage paths are eligible for download", () => {
  assert.equal(isPowerPointFile({ file_name: "510. Cântare.pptx", file_type: "pptx" }), true);
  assert.equal(canCheckStoredPowerPoint({ file_name: "510. Cântare.pptx", file_type: "pptx", storage_path: null }), false);
  assert.equal(canCheckStoredPowerPoint({ file_name: "510. Cântare.pptx", file_type: "pptx", storage_path: "imports/archive.zip#510.pptx" }), false);
  assert.equal(canCheckStoredPowerPoint({ file_name: "510. Cântare.pptx", file_type: "pptx", storage_path: "presentations/tineri/510.pptx", presentation_only_v58: true, upload_complete_v58: false }), false);
  assert.equal(canCheckStoredPowerPoint({ file_name: "001.pptx", file_type: "pptx", storage_path: "presentations/cartea-rosie/001.pptx", presentation_only_v58: true, upload_complete_v58: true }), true);
  assert.deepEqual(storageObjectTarget("presentations/cartea-rosie/001.pptx"), { path: "presentations/cartea-rosie/001.pptx", folder: "presentations/cartea-rosie", name: "001.pptx" });
});
