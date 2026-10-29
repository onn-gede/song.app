import {createHash} from 'node:crypto';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validatePresentationManifest(m){
 if(m?.schema!==1||!Array.isArray(m.songs)||!m.songs.length||m.songs.length!==m.count)throw Error('Catalogul prezentărilor este incomplet.');
 const numbers=new Set(),names=new Set();for(const s of m.songs){if(!/^\d{3,4}$/.test(s.number)||Number(s.number)<1||numbers.has(Number(s.number))||names.has(s.fileName)||!s.title?.trim()||!['sha256','previewSha256'].every(k=>/^[a-f0-9]{64}$/.test(s[k]||''))||/[\\/]/.test(s.fileName)||!s.fileName.toLowerCase().endsWith('.ppt')||s.preview!==`local-assets/black-book/previews/${s.number}.pdf`)throw Error('Titlu, număr sau fișier nevalid / repetat.');numbers.add(Number(s.number));names.add(s.fileName);}
 return {count:m.count,min:Math.min(...numbers),max:Math.max(...numbers)};
}
export async function validatePresentationAssets(manifest,archive,zip,readPreview){
 validatePresentationManifest(manifest);if(sha256(archive)!==manifest.archiveSha256)throw Error('Arhiva PPT nu corespunde catalogului verificat. Nu s-a scris nimic în bază.');
 const files=Object.values(zip.files).filter(f=>!f.dir);if(files.length!==manifest.count)throw Error('Număr diferit de fișiere în arhivă.');const ready=[];
 for(const song of manifest.songs){const entry=zip.file(song.fileName);if(!entry)throw Error('Lipsește prezentarea '+song.fileName);const original=await entry.async('nodebuffer'),preview=await readPreview(song.preview);if(original.length!==song.bytes||sha256(original)!==song.sha256||sha256(preview)!==song.previewSha256||preview.subarray(0,5).toString()!=='%PDF-')throw Error('Fișier sau previzualizare modificată: '+song.number);ready.push({song,original,preview});}
 return ready;
}
