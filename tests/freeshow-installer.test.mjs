import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const installer = path.join(root, "tools", "freeshow-connector-installer");

test("FreeShow Windows installer contains install, start, stop and uninstall controls", () => {
  for (const name of [
    "SETUP-CONNECTOR.cmd",
    "Installer-FreeShow.ps1",
    "Start-Connector.ps1",
    "Stop-Connector.ps1",
    "Uninstall-Connector.ps1",
  ]) {
    assert.equal(fs.existsSync(path.join(installer, name)), true, `${name} lipsește`);
  }

  const wizard = fs.readFileSync(path.join(installer, "Installer-FreeShow.ps1"), "utf8");
  assert.match(wizard, /Pornește automat conectorul odată cu Windows/);
  assert.match(wizard, /Pornește conectorul după finalizarea instalării/);
  assert.match(wizard, /Porneste conectorul\.lnk/);
  assert.match(wizard, /Opreste conectorul\.lnk/);
  assert.match(wizard, /Dezinstaleaza conectorul\.lnk/);
  assert.doesNotMatch(wizard, /New-Shortcut[^\n]+[șțȘȚ][^\n]+\.lnk/);
  assert.match(wizard, /127\.0\.0\.1:5510\/freeshow/);
  assert.match(wizard, /function Show-WizardStep/);
  assert.match(wizard, /\.BringToFront\(\)/);

  const inno = fs.readFileSync(path.join(installer, "SongApp-FreeShow-Connector.iss"), "utf8");
  assert.match(inno, /OutputBaseFilename=SongApp-FreeShow-Connector-Setup/);
  assert.match(inno, /PrivilegesRequired=lowest/);
  assert.match(inno, /Name: "autostart"/);

  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "build-freeshow-connector-exe.yml"), "utf8");
  assert.match(workflow, /runs-on: windows-latest/);
  assert.match(workflow, /SongApp-FreeShow-Connector-Setup\.exe/);
  assert.match(workflow, /gh release upload/);
  assert.match(workflow, /connector-latest/);
});
