import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {completeBuild,buildArguments} from './local-build-state.mjs';
// A failed build must never be mistaken for an older complete build.
fs.rmSync('.next',{recursive:true,force:true,maxRetries:5,retryDelay:200});
const args=buildArguments(process.platform,process.argv.slice(2));
if(args.includes('--webpack'))console.log('Compilare cu Webpack pentru compatibilitate Windows.');
const result=spawnSync(process.execPath,[path.resolve('node_modules/next/dist/bin/next'),...args],{stdio:'inherit',env:process.env});
if(result.error||result.status!==0||!completeBuild()){
 fs.rmSync('.next/BUILD_ID',{force:true});
 console.error('Compilarea nu s-a încheiat. Aplicația nu va porni cu fișiere incomplete.');
 process.exit(result.status||1);
}
