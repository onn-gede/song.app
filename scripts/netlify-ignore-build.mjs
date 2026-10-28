import { spawnSync } from 'node:child_process';
const before=process.env.CACHED_COMMIT_REF,after=process.env.COMMIT_REF;
if(!before||!after)process.exit(1);
const diff=spawnSync('git',['diff','--name-only',before,after],{encoding:'utf8'});
if(diff.status!==0)process.exit(1);
const files=diff.stdout.trim().split('\n').filter(Boolean);
process.exit(files.length>0&&files.every(name=>name==='ops/heartbeat.json')?0:1);
