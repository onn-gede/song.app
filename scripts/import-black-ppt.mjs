#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {createClient} from '@supabase/supabase-js';
import JSZip from 'jszip';
import {validatePresentationAssets,validatePresentationManifest} from './black-ppt-lib.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function password(){
 if(!process.stdin.isTTY)throw Error('Pentru autentificare rulează într-o fereastră PowerShell interactivă.');
 process.stdout.write('Parola SongApp (nu se afișează): ');process.stdin.setRawMode(true);process.stdin.resume();
 return await new Promise((resolve,reject)=>{let value='';const onData=chunk=>{for(const c of chunk.toString('utf8')){if(c==='\u0003'){cleanup();reject(Error('Autentificare oprită.'));return;}if(c==='\r'||c==='\n'){cleanup();resolve(value);return;}if(c==='\u007f'||c==='\b'){value=value.slice(0,-1);}else if(c>=' ')value+=c;}};function cleanup(){process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('data',onData);});
}
async function database(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!(service||anon))throw Error('Lipsesc configurațiile Supabase din .env.local. Păstrează fișierul existent al aplicației.');
 const db=createClient(url,service||anon,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(45000)})}});
 if(!service){const rl=createInterface({input:process.stdin,output:process.stdout});const email=(await rl.question('E-mail cont SongApp cu drept de editare: ')).trim();rl.close();const secret=await password();const {error}=await db.auth.signInWithPassword({email,password:secret});if(error)throw Error('Autentificarea SongApp a eșuat. Verifică datele local.');}
 return db;
}


async function main(){
 const args=process.argv.slice(2),zipAt=args.indexOf('--zip'),collectionAt=args.indexOf('--collection');if(zipAt>=0&&!args[zipAt+1])throw Error('Lipsește calea arhivei.');const customCollection=collectionAt>=0?args[collectionAt+1]:null;if(customCollection&&!/^[a-f0-9-]{36}$/i.test(customCollection))throw Error('Colecție invalidă.');
 const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'data/black-book-ppt.json'),'utf8'));const summary=validatePresentationManifest(manifest);console.log(`${summary.count} prezentări, numerele ${manifest.firstNumber}–${manifest.lastNumber}. Verific fișierele înainte de conectare…`);
 const archive=await fs.readFile(zipAt>=0?path.resolve(args[zipAt+1]):path.join(ROOT,'local-assets/black-book/originals.zip'));const zip=await JSZip.loadAsync(archive);const ready=await validatePresentationAssets(manifest,archive,zip,file=>fs.readFile(path.join(ROOT,file)));
 console.log('Toate originalele și PDF-urile corespund catalogului. Nu se extrag versuri și nu se arhivează date.');if(args.includes('--prepare-only')){console.log('Verificare încheiată fără conectare sau scriere în Supabase.');return;}
 const db=await database();const call=async(name,params)=>{const {data,error}=await db.rpc(name,params);if(error)throw Error(error.message+' (verifică UPDATE-V58.sql și drepturile contului)');return data;};
 const destination=await call('presentation_collection_v58',{p_collection_id:customCollection,p_name:manifest.collectionName});console.log('Destinație: '+destination.name);const dir=path.join(ROOT,'.songapp-imports/black-ppt-v58');await fs.mkdir(dir,{recursive:true});const report={date:new Date().toISOString(),collection:destination,titles:0,files:0,errors:[],results:[]};const reportPath=path.join(dir,'raport-'+Date.now()+'.json');const save=()=>fs.writeFile(reportPath,JSON.stringify(report,null,2));
 // First make the complete title catalog searchable; attachments have an explicit pending state.
 for(const item of ready){const s=item.song;item.registered=await call('register_presentation_v58',{p_collection_id:destination.id,p_number:s.number,p_title:s.title,p_file_name:s.fileName,p_sha256:s.sha256,p_preview_sha256:s.previewSha256,p_first_line:s.firstLine});report.titles++;report.results.push({number:s.number,title:s.title,...item.registered});if(report.titles%50===0||report.titles===ready.length){console.log(`Titluri ${report.titles}/${ready.length}`);await save();}}
 let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<ready.length){const item=ready[next++],s=item.song,r=item.registered;try{let complete=r.complete;if(complete){const {error}=await db.rpc('complete_presentation_v58',{p_file_id:r.fileId});if(error){if(error.message.includes('nu este completă'))complete=false;else throw Error(error.message);}}
  if(!complete){for(const [key,bytes,mime]of [[r.path,item.original,'application/vnd.ms-powerpoint'],[r.previewPath,item.preview,'application/pdf']]){const {error}=await db.storage.from('song-files').upload(key,bytes,{contentType:mime,upsert:true});if(error)throw Error(error.message);}await call('complete_presentation_v58',{p_file_id:r.fileId});}
  report.files++;console.log(`Fișiere ${report.files}/${ready.length} · ${s.number} ${s.title}`);
 }catch(e){report.errors.push({number:s.number,error:e.message});console.error(`${s.number}: încărcare neconfirmată. Reia aceeași comandă.`);}}}));await save();console.log(`Titluri: ${report.titles}. PPT + PDF confirmate: ${report.files}. Raport: ${path.relative(ROOT,reportPath)}`);if(report.errors.length){process.exitCode=1;return;}console.log('Import încheiat. Reîncarcă Colecții / Cântări. Reluarea comenzii păstrează aceleași cântări și verifică fișierele existente.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
