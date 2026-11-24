import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const root = process.cwd();
const installerDir = path.join(root, "tools", "freeshow-connector-installer");
const connectorDir = path.join(root, "tools", "freeshow-connector");
const output = path.join(root, "public", "downloads", "SongApp-FreeShow-Connector-Setup-Windows.zip");
const files = [
  ["SETUP-CONNECTOR.cmd", path.join(installerDir, "SETUP-CONNECTOR.cmd")],
  ["Installer-FreeShow.ps1", path.join(installerDir, "Installer-FreeShow.ps1")],
  ["Start-Connector.ps1", path.join(installerDir, "Start-Connector.ps1")],
  ["Stop-Connector.ps1", path.join(installerDir, "Stop-Connector.ps1")],
  ["Uninstall-Connector.ps1", path.join(installerDir, "Uninstall-Connector.ps1")],
  ["connector.mjs", path.join(connectorDir, "connector.mjs")],
  ["CITESTE-MAI-INTAI.txt", path.join(connectorDir, "CITESTE-MAI-INTAI.txt")],
];

for (const [, filePath] of files) {
  if (!fs.existsSync(filePath)) throw new Error(`Lipsește fișierul installerului: ${filePath}`);
}
const zip = new JSZip();
for (const [name, filePath] of files) {
  let content = fs.readFileSync(filePath);
  if (
    name.toLowerCase().endsWith(".ps1") &&
    !(content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf)
  ) {
    content = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), content]);
  }
  zip.file(name, content);
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(
  output,
  await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } }),
);
console.log(`Installer FreeShow pregătit: ${output}`);
