import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("lockfile root version matches the app and dependency versions match their archives", () => {
  const manifest=JSON.parse(fs.readFileSync("package.json","utf8"));
  const lock=JSON.parse(fs.readFileSync("package-lock.json","utf8"));
  assert.equal(lock.version,manifest.version);
  assert.equal(lock.packages[""].version,manifest.version);
  for(const [name,pkg] of Object.entries<any>(lock.packages)) {
    if(!name || !pkg.resolved?.startsWith("https://registry.npmjs.org/") || !pkg.resolved.endsWith(".tgz"))continue;
    assert.ok(pkg.resolved.endsWith(`-${pkg.version}.tgz`), `${name}: version ${pkg.version} differs from ${pkg.resolved}`);
  }
});
