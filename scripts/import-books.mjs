#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createInterface} from 'node:readline/promises';
import {createClient} from '@supabase/supabase-js';
import {normalize} from './red-book-import-lib.mjs';
const ROOT=process.cwd();
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
 const arg=process.argv.find(a=>a.startsWith('--book='))?.split('=')[1];if(arg&&!['cr','cn'].includes(arg))throw Error('Folosește --book=cr sau --book=cn.');
 const codes=arg?[arg]:['cr','cn'],catalogs=[];
 if(codes.includes('cn'))throw Error('Importul parțial Carte Neagră din v57 este blocat. Așteaptă catalogul complet verificat 001–805. Nu s-a efectuat nicio conectare sau scriere în Supabase.');
 for(const code of codes){const catalog=JSON.parse(await fs.readFile(path.join(ROOT,'data','book-catalogs',code+'.json'),'utf8'));if(catalog.category!==code||!Array.isArray(catalog.songs)||!catalog.songs.length)throw Error('Catalog invalid.');const ids=new Set(),numbers=new Set();for(const song of catalog.songs){if(song.category!==code||song.error||song.lyrics.length<20||!song.sections.length)throw Error('Versuri incomplete. Importul a fost oprit.');for(const id of song.sourceIds){if(ids.has(id))throw Error('ID sursă repetat.');ids.add(id);}if(song.number){if(numbers.has(song.number))throw Error('Număr repetat.');numbers.add(song.number);}if(song.sections.some(s=>!s.content.trim()))throw Error('Strofă goală.');}if(code==='cr'&&(catalog.songs.length!==601||Array.from({length:601},(_,i)=>String(i+1).padStart(3,'0')).some(n=>!numbers.has(n))))throw Error('Cartea Roșie nu are exact 601 cântări.');catalogs.push(catalog);console.log(`${code}: ${catalog.songs.length} cântări, ${ids.size} înregistrări sursă, catalog verificat ${catalog.retrievedAt}.`);}
 if(process.argv.includes('--prepare-only')){console.log('Verificare încheiată. Nicio scriere în baza de date.');return;}
 const db=await database();const dir=path.join(ROOT,'.songapp-imports','books-v57');await fs.mkdir(dir,{recursive:true});const report={date:new Date().toISOString(),results:[],summary:{}};const file=path.join(dir,'raport-'+Date.now()+'.json');
 const call=async(name,params)=>{const {data,error}=await db.rpc(name,params);if(error)throw Error('Verifică UPDATE-V57.sql și drepturile contului. Cod: '+error.code);return data;};
 for(const catalog of catalogs){const code=catalog.category,songIds=[];let review=false;const destination=await call('book_collection_v57',{p_code:code});console.log('Destinație: '+destination.name);
  for(const s of catalog.songs){const result=await call('upsert_book_song_v57',{p_code:code,p_title:s.title,p_number:s.number,p_lyrics:s.lyrics,p_sections:s.sections,p_source_ids:s.sourceIds,p_url:s.url});report.results.push({category:code,number:s.number,title:s.title,...result});if(result.songId)songIds.push(result.songId);else review=true;report.summary[result.status]=(report.summary[result.status]||0)+1;await fs.writeFile(file,JSON.stringify(report,null,2));console.log(`${code} ${s.number||'fără nr.'} ${s.title}: ${result.status}`);}
  if(review||new Set(songIds).size!==catalog.songs.length){console.error('Există corespondente neclare. Înregistrările vechi NU au fost arhivate; verifică raportul.');process.exitCode=1;}else{const result=await call('finalize_book_catalog_v57',{p_code:code,p_song_ids:songIds,p_expected:catalog.songs.length});console.log(`${code}: ${result.songs} cântări confirmate; ${result.archivedSources} surse vechi arhivate. Programele și copiile vechi sunt păstrate.`);}
 }
 console.log(JSON.stringify(report.summary));console.log('Raport: '+path.relative(ROOT,file));console.log('Reîncarcă paginile Colecții / Cântări.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
