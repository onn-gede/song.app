import fs from 'node:fs';
import path from 'node:path';
export function completeBuild(directory='.next') {
 try {
  if(!fs.readFileSync(path.join(directory,'BUILD_ID'),'utf8').trim())return false;
  for(const name of ['prerender-manifest.json','routes-manifest.json','required-server-files.json']){
   const value=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
   if(!value||typeof value!=='object'||Array.isArray(value))return false;
  }
  return true;
 }catch{return false;}
}
export function buildArguments(platform=process.platform,extra=[]) {
 return ['build',...(platform==='win32'&&!extra.some(x=>['--webpack','--turbopack','--turbo'].includes(x))?['--webpack']:[]),...extra];
}
