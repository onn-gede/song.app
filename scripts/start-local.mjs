import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const manifest=path.resolve('.next/BUILD_ID');
const sources=['app','components','lib','public','package.json','package-lock.json','next.config.ts','tsconfig.json','.env.local','.env'];
function newest(file) {
  if(!fs.existsSync(file))return 0;
  const stat=fs.statSync(file);
  return stat.isDirectory()?Math.max(stat.mtimeMs,...fs.readdirSync(file).map(name=>newest(path.join(file,name)))):stat.mtimeMs;
}
const builtAt=fs.existsSync(manifest)?fs.statSync(manifest).mtimeMs:0;
const needsBuild=!builtAt || sources.some(file=>newest(file)>builtAt);
const cli=path.resolve('node_modules/next/dist/bin/next');
function run(command) {
  const result=spawnSync(process.execPath,[cli,command],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status || 1);
}
if(needsBuild){console.log('Pregătesc versiunea optimizată. Compilarea solicită temporar procesorul.');run('build');}
console.log('Pornesc SongApp în modul optimizat: http://localhost:3000');
run('start');
