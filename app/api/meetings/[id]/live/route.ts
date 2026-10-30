import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers={'Cache-Control':'private, no-store'};
function failure(error:{code?:string}){
 if(error.code==='42501'||error.code==='PGRST301')return Response.json({error:'Sesiunea a expirat sau contul nu poate modifica programul. Autentifică-te din nou.'},{status:403,headers});
 if(error.code==='42883'||error.code==='PGRST202')return Response.json({error:'Actualizarea bazei lipsește. Rulează UPDATE-V57.sql în proiectul Supabase existent.'},{status:503,headers});
 if(error.code==='P0002')return Response.json({error:'Elementul nu mai există în acest program. Actualizează lista de propuneri.'},{status:404,headers});
 console.error('Program mutation unavailable',{code:error.code});
 return Response.json({error:'Nu am putut confirma salvarea. Reîncearcă. Dacă eroarea persistă, verifică aplicarea UPDATE-V57.sql și jurnalul serverului.'},{status:503,headers});
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!uuid.test(id))return Response.json({error:'Program invalid.'},{status:400,headers});
 try{const db=await createClient();if(new URL(_request.url).searchParams.get('snapshot')==='1'){const {data,error}=await db.rpc('get_meeting_snapshot_v46',{p_meeting_id:id});if(error)return failure(error);if(!data)return Response.json({error:'Acces interzis.'},{status:403,headers});return Response.json({snapshot:data},{headers});}const {data,error}=await db.rpc('program_notifications_v54',{p_meeting_id:id});if(error)return failure(error);return Response.json({pending:data||[]},{headers});}
 catch{return Response.json({error:'Conexiunea nu este disponibilă momentan.'},{status:503,headers});}
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cerere invalidă.'},{status:403,headers});
 const {id}=await params;if(!uuid.test(id))return Response.json({error:'Program invalid.'},{status:400,headers});
 let body;try{body=await request.json();}catch{return Response.json({error:'Cerere invalidă.'},{status:400,headers});}
 if(!body||typeof body!=='object')return Response.json({error:'Cerere invalidă.'},{status:400,headers});
 const common=body.action==='common'&&uuid.test(String(body.itemId||''))&&typeof body.enabled==='boolean';
 const review=body.action==='review'&&uuid.test(String(body.contributionId||''))&&typeof body.accept==='boolean';
 const add=body.action==='add'&&uuid.test(String(body.songId||''))&&uuid.test(String(body.requestId||''))&&(!body.sourceId||uuid.test(String(body.sourceId)))&&typeof body.isBackup==='boolean';
 if(!common&&!review&&!add)return Response.json({error:'Acțiune invalidă.'},{status:400,headers});
 try{
  const db=await createClient();const {data,error}=add?await db.rpc('add_program_song_v57',{p_meeting_id:id,p_song_id:body.songId,p_request_id:body.requestId,p_source_id:body.sourceId||null,p_is_backup:body.isBackup,p_selected_key:body.selectedKey||null}):common
   ?await db.rpc('set_program_common_v54',{p_meeting_id:id,p_item_id:body.itemId,p_enabled:body.enabled})
   :await db.rpc('review_program_contribution_v54',{p_meeting_id:id,p_contribution_id:body.contributionId,p_accept:body.accept});
  if(error)return failure(error);
  revalidatePath('/songs');revalidatePath('/songs/[id]','page');revalidatePath('/dashboard');
  revalidatePath(`/meetings/${id}`);revalidatePath('/program','layout');
  return Response.json(common?{snapshot:data}:data,{headers});
 }catch{return Response.json({error:'Conexiunea s-a întrerupt. Verifică lista și reîncearcă.'},{status:503,headers});}
}
