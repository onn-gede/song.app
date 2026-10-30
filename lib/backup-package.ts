import JSZip from 'jszip';
export type Row = Record<string, any>;
export type PackageData = {format:string;version:number;kind:'backup'|'program';createdAt:string;tables:Record<string,Row[]>;referenceOnly?:Record<string,Row[]>};
export type Attachment = {path:string;entry:string;sha256:string;size:number;mime:string};
export type Manifest = {format:string;version:number;kind:string;createdAt:string;dataHash:string;attachments:Attachment[]};
export const MAX_ARCHIVE=500*1024*1024, MAX_EXPANDED=1024*1024*1024;
export async function hash(bytes:ArrayBuffer|Uint8Array){const b=new Uint8Array(bytes instanceof ArrayBuffer?bytes:bytes.slice());return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export function attachmentPaths(data:PackageData){return [...new Set((data.tables.song_files||[]).flatMap(f=>[f.storage_path,f.preview_path_v58]).filter((x):x is string=>typeof x==='string'&&x.length>0))];}
export function escaped(x:unknown){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export function programDocument(data:PackageData,files:Attachment[]){
 const m=data.tables.meetings?.[0]||{},songs=new Map((data.tables.songs||[]).map(s=>[s.id,s]));
 const items=[...(data.tables.meeting_items||[])].sort((a,b)=>Number(a.is_backup)-Number(b.is_backup)||a.position-b.position);
 return `<!doctype html><html lang="ro"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escaped(m.title)}</title><style>body{font:16px system-ui;max-width:900px;margin:32px auto;padding:16px;color:#18232e}li{padding:14px;border-bottom:1px solid #ddd}small{display:block;color:#465565}pre{white-space:pre-wrap}h2{margin-top:32px}@media print{a{color:inherit}}</style><h1>${escaped(m.title)}</h1><p>${escaped(new Date(m.meeting_date).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'}))}</p><p><b>Echipa:</b> ${escaped(m.principal_responsible)} · ${escaped((m.secondary_responsibles||[]).join(', '))}</p><p>${escaped(m.notes)}</p>${[false,true].map(backup=>`<h2>${backup?'Rezervă':'Ordinea programului'}</h2><ol>${items.filter(i=>!!i.is_backup===backup).map(i=>{const s=songs.get(i.song_id);const attached=(data.tables.song_files||[]).filter(f=>f.song_id===i.song_id);return `<li><b>${escaped(s?.title||i.custom_title||i.item_type)}</b><small>${escaped(i.selected_key||s?.default_key)} · ${escaped(i.performance_structure||s?.structure)}</small><p>Solist: ${escaped(i.responsible_name)}</p><pre>${escaped(i.notes||i.custom_text)}</pre>${attached.map(f=>[f.storage_path,f.preview_path_v58].filter(Boolean).map(p=>{const a=files.find(a=>a.path===p);return a?`<a href="${escaped(a.entry)}">${escaped(p===f.preview_path_v58?'PDF':f.file_name)}</a> `:'';}).join('')).join('')}</li>`;}).join('')}</ol>`).join('')}<p>SongApp BCBgiroc · Export ${escaped(data.createdAt)}</p></html>`;
}
export async function readPackage(file:File){
 if(file.size>MAX_ARCHIVE)throw Error('Arhiva depășește limita de 500 MB.');
 const zip=await JSZip.loadAsync(await file.arrayBuffer(),{checkCRC32:false});
 const entries=Object.values(zip.files).filter(f=>!f.dir);let total=0;
 for(const f of entries){const size=(f as unknown as {_data?:{uncompressedSize:number}})._data?.uncompressedSize;if(!Number.isFinite(size)||size! < 0)throw Error('Dimensiune ZIP invalidă.');total+=size!;if(total>MAX_EXPANDED)throw Error('Arhiva decomprimată depășește 1 GB.');const original=(f as unknown as {unsafeOriginalName?:string}).unsafeOriginalName||f.name;if(original!==f.name||f.name.startsWith('/')||f.name.split('/').includes('..')||f.name.includes('\\'))throw Error('Cale ZIP invalidă.');}
 const mf=zip.file('manifest.json'),df=zip.file('data.json');if(!mf||!df)throw Error('Arhiva nu este un backup SongApp.');
 const manifest=JSON.parse(await mf.async('string')) as Manifest;const bytes=await df.async('uint8array');
 if(manifest.format!=='songapp-package'||manifest.version!==64||!['backup','program'].includes(manifest.kind)||!Array.isArray(manifest.attachments))throw Error('Versiune de arhivă neacceptată.');
 if(await hash(bytes)!==manifest.dataHash)throw Error('Datele din arhivă sunt deteriorate.');
 const data=JSON.parse(new TextDecoder().decode(bytes)) as PackageData;
 if(data.format!==manifest.format||data.version!==64||data.kind!==manifest.kind||!data.tables||typeof data.tables!=='object')throw Error('Date incompatibile.');
 const paths=attachmentPaths(data),seen=new Set<string>();
 for(const a of manifest.attachments){if(!a||typeof a.path!=='string'||seen.has(a.path)||!paths.includes(a.path)||!/^files\/[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(a.entry)||!Number.isInteger(a.size)||a.size<0||a.size>26_214_400)throw Error('Index de fișiere invalid.');seen.add(a.path);const f=zip.file(a.entry);if(!f)throw Error('Atașament lipsă: '+a.path);const b=await f.async('uint8array');if(b.byteLength!==a.size||await hash(b)!==a.sha256)throw Error('Atașament deteriorat: '+a.path);}
 if(paths.some(p=>!seen.has(p)))throw Error('Backup incomplet: lipsesc atașamente.');
 // Isolated immutable, content-addressed paths: never overwrite existing production files.
 const tables=structuredClone(data.tables);const map=new Map(manifest.attachments.map(a=>[a.path,'restored-v64/'+a.entry.slice(6)]));
 for(const f of tables.song_files||[])for(const key of ['storage_path','preview_path_v58'])if(f[key])f[key]=map.get(f[key]);
 return {zip,data,manifest,tables};
}
