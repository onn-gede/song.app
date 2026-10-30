import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {completeBuild,buildArguments} from '../scripts/local-build-state.mjs';
test('partial build with BUILD_ID cannot start; all manifests must parse',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'song-build-'));
 try{assert.equal(completeBuild(dir),false);fs.writeFileSync(path.join(dir,'BUILD_ID'),'partial');assert.equal(completeBuild(dir),false);
 for(const name of ['prerender-manifest.json','routes-manifest.json','required-server-files.json'])fs.writeFileSync(path.join(dir,name),'{}');
 assert.equal(completeBuild(dir),true);fs.writeFileSync(path.join(dir,'prerender-manifest.json'),'{');assert.equal(completeBuild(dir),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Windows defaults to Webpack and explicit build engine is respected',()=>{
 assert.deepEqual(buildArguments('win32'),['build','--webpack']);assert.deepEqual(buildArguments('linux'),['build']);assert.deepEqual(buildArguments('win32',['--turbopack']),['build','--turbopack']);
});
