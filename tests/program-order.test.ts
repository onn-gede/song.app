import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reorderedProgram} from '../lib/program-order.js';
import type {ProgramItem} from '../lib/meeting-state.js';
test('v65 immediate reorder handles arrows, both groups, no-op and does not mutate original',()=>{
 const items=[{id:'a',position:1,is_backup:false},{id:'b',position:2,is_backup:false},{id:'c',position:3,is_backup:false},{id:'d',position:4,is_backup:true}] as ProgramItem[];
 assert.deepEqual(reorderedProgram(items,'b',false,'a').map(i=>i.id),['b','a','c','d']);
 assert.deepEqual(reorderedProgram(items,'a',false,'c').map(i=>i.id),['b','a','c','d']);
 assert.deepEqual(reorderedProgram(items,'a',false,null).map(i=>i.id),['b','c','a','d']);
 const transfer=reorderedProgram(items,'d',false,'b');assert.deepEqual(transfer.map(i=>i.id),['a','d','b','c']);assert.equal(transfer[1].is_backup,false);
 assert.equal(reorderedProgram(items,'a',true,null).at(-1)?.is_backup,true);assert.deepEqual(items.map(i=>i.id),['a','b','c','d']);assert.equal(reorderedProgram(items,'a',false,'a'),items);
});
