#!/usr/bin/env node
// Maintainer command only. Importing the bundled verified catalogs does not need LibreOffice.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {groupCatalog,text,sectionsFromLyrics,lyricsFromCurrentPptx,sourceUrl} from './red-book-import-lib.mjs';
const root=process.cwd(),cache=path.join(root,'.songapp-imports','prepare-books'),out=path.join(root,'data','book-catalogs');
const only=process.argv.find(a=>a.startsWith('--book='))?.slice(7);if(only&&!['cr','cn'].includes(only))throw Error('Categorie nepermisă.');
async function download(raw,category){const u=new URL(sourceUrl(raw));if(category&&!decodeURIComponent(u.pathname).startsWith(`/cantari/${category}/`))throw Error('Fișier din altă categorie.');const r=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const b=Buffer.from(await r.arrayBuffer());if(b.length>8*1024*1024)throw Error('Fișier prea mare.');return b;}
async function main(){await fs.mkdir(cache,{recursive:true});await fs.mkdir(out,{recursive:true});
 for(const category of only?[only]:['cr','cn']){let pages=1,total=null,rows=[];for(let page=1;page<=pages;page++){const url=`https://www.cantaricrestine.ro/api.php?token=7284160935&categorie=${category}&limita=2000&pagina=${page}`;const data=JSON.parse((await download(url)).toString('utf8')),p=data.paginatie;if(!p||Number(p.pagina_curenta)!==page||Number(p.total_pagini)<1||Number(p.total_pagini)>100)throw Error('Paginație invalidă.');pages=Number(p.total_pagini);if(total!==null&&total!==Number(p.total_rezultate))throw Error('Catalog modificat în timpul citirii.');total=Number(p.total_rezultate);rows.push(...Object.values(data.rezultate||{}));}
 if(rows.length!==total)throw Error('Catalog incomplet.');const {groups}=groupCatalog(rows,category);if(category==='cn'){const assigned=new Set(groups.flatMap(g=>g.rows.map(r=>String(r.id))));for(const row of rows)if(!assigned.has(String(row.id)))groups.push({number:null,title:row.denumire.replace(/[_ ]v\d+$/i,'').trim(),rows:[row]});}
 if(category==='cr'&&(groups.length!==601||groups.some((g,i)=>Number(g.number)!==i+1)))throw Error('Revizuiește catalogul: nu conține exact 001–601.');
 const ready=[];for(const group of groups){const withText=group.rows.find(r=>text(r.descriere));let lyrics=withText?text(withText.descriere):'',origin='API';if(!lyrics){const row=group.rows[0],input=path.join(cache,`${category}-${row.id}.ppt`),converted=path.join(cache,`${category}-${row.id}.pptx`);await fs.writeFile(input,await download(row.url_fisier,category));execFileSync(process.env.SOFFICE_BIN||'soffice',[`-env:UserInstallation=${pathToFileURL(path.join(cache,'lo-profile')).href}`,'--headless','--convert-to','pptx','--outdir',cache,input],{timeout:120000,stdio:'inherit'});lyrics=await lyricsFromCurrentPptx(await fs.readFile(converted));origin='PowerPoint convertit (slide-uri curente)';}
 const sections=sectionsFromLyrics(lyrics);if(lyrics.length<20||!sections.length)throw Error(`Versuri incomplete: ${category} ${group.number||group.title}`);ready.push({number:group.number,title:group.title,category,lyrics,origin,sections,sourceIds:group.rows.map(r=>String(r.id)),url:sourceUrl(group.rows[0].url)});console.log(`${category} ${group.number||'—'}: ${sections.length} secțiuni`);}
 await fs.writeFile(path.join(out,category+'.json'),JSON.stringify({retrievedAt:new Date().toISOString(),category,songs:ready},null,2));console.log(`${category}: ${ready.length} cântări pregătite; nicio scriere în Supabase.`);
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
