import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function worker(windows:any[]=[]){
 const handlers:Record<string,(event:any)=>void>={},opened:string[]=[];
 const self={location:{origin:'https://songapp.example'},skipWaiting:async()=>{},clients:{claim:async()=>{},matchAll:async()=>windows,openWindow:async(url:string)=>{opened.push(url);}},addEventListener:(name:string,handler:(event:any)=>void)=>{handlers[name]=handler;}};
 vm.runInNewContext(fs.readFileSync('public/notifications-sw.js','utf8'),{self,URL});
 async function click(path:string){let closed=false,done:Promise<any>|undefined;handlers.notificationclick({notification:{data:{url:path},close:()=>{closed=true;}},waitUntil:(p:Promise<any>)=>{done=p;}});await done;return closed;}
 return {opened,click};
}
test('v54 notification click focuses the existing program without opening another tab',async()=>{
 let focused=false;const w=worker([{url:'https://songapp.example/program/joi',focus:async()=>{focused=true;}}]);
 assert.equal(await w.click('/program/joi'),true);assert.equal(focused,true);assert.deepEqual(w.opened,[]);
});
test('v54 notification worker only opens a public program on its own origin',async()=>{
 const w=worker();await w.click('https://untrusted.example');await w.click('//untrusted.example/program/x');await w.click('/admin');assert.deepEqual(w.opened,[]);
 await w.click('/program/duminica');assert.deepEqual(w.opened,['https://songapp.example/program/duminica']);
});
