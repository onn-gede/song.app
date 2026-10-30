import {readFile} from 'node:fs/promises';
import path from 'node:path';
import manifest from '@/data/black-book-ppt.json';
import {requireProfile} from '@/lib/auth';
export async function GET(_request:Request,{params}:{params:Promise<{sha:string}>}){
 const headers={'Cache-Control':'private, no-store'};try{await requireProfile('editor');}catch{return Response.json({error:'Acces interzis.'},{status:403,headers});}
 const {sha}=await params;const item=manifest.songs.find(s=>s.sha256===sha);if(!item)return new Response(null,{status:404,headers});
 try{const bytes=await readFile(path.join(process.cwd(),'local-assets','black-book','previews',`${item.number}.pdf`));return new Response(bytes,{headers:{...headers,'Content-Type':'application/pdf','X-Content-Type-Options':'nosniff'}});}catch{return new Response(null,{status:404,headers});}
}
