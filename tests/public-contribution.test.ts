import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicText,publicPosition,publicContributionError} from '../lib/public-contribution';
test('public proposal validation rejects oversized and non-text payloads, accepts Unicode boundaries and optional values',()=>{
 assert.equal(publicText('😀'.repeat(120),120,'Nume'),'😀'.repeat(120));
 assert.throws(()=>publicText('x'.repeat(121),120,'Nume'),/maximum/);
 assert.throws(()=>publicText({} as unknown,120,'Nume'),/invalidă/);
 assert.equal(publicText(null,120,'Nume'),'');
 assert.equal(publicText(' Nume ',120,'Nume'),'Nume');
 assert.equal(publicPosition('1'),1);assert.equal(publicPosition(999),999);assert.equal(publicPosition(''),null);
 for(const value of [0,1000,-1,1.5,'bad',Infinity])assert.throws(()=>publicPosition(value));
 assert.match(publicContributionError({code:'P0073'}).message,/multe propuneri/);
 assert.doesNotMatch(publicContributionError({code:'XX000',message:'internal credentials'} as any).message,/credentials/);
});
