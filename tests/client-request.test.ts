import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestJson} from '../lib/client-request';

test('interactive requests handle sessions, non-JSON failures, rate limits, timeouts and cancellation without replaying mutations',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return Response.json({ok:true});};
  assert.deepEqual(await requestJson('/test'),{ok:true});
  for(const [status,message] of [[401,/Sesiunea/],[403,/permisiunea/],[429,/multe cereri/]] as const){globalThis.fetch=async()=>new Response('HTML',{status});await assert.rejects(()=>requestJson('/test'),message);}
  globalThis.fetch=async()=>new Response('<html>gateway error</html>',{status:502});
  await assert.rejects(()=>requestJson('/test',{method:'PATCH'}),/Verifică programul/);
  calls=0;globalThis.fetch=async(_url,options)=>{calls++;return new Promise((_resolve,reject)=>{options?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});};
  await assert.rejects(()=>requestJson('/test',{method:'PATCH'},5),/Verifică programul/);assert.equal(calls,1);
  const controller=new AbortController();const work=requestJson('/test',{signal:controller.signal},1000);controller.abort();await assert.rejects(()=>work,{name:'AbortError'});
  globalThis.fetch=async()=>{throw new TypeError('Network offline');};await assert.rejects(()=>requestJson('/test'),/Conexiunea/);
 }finally{globalThis.fetch=original;}
});
