import {requireProfile} from '@/lib/auth';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return Response.json({error:'Cântare invalidă.'},{status:400});
 try{const {supabase}=await requireProfile();const {data,error}=await supabase.rpc('song_details_v62',{p_song_id:id});if(error)throw error;return Response.json(data||{},{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'Preview indisponibil. Verifică autentificarea și UPDATE-V62.sql.'},{status:403});}
}
