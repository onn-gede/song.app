import {createClient} from '@/lib/supabase/server';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const url=new URL(request.url),month=url.searchParams.get('month'),exclude=url.searchParams.get('exclude');
 if(!uuid.test(id)||!month||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||(exclude&&!uuid.test(exclude)))return Response.json({error:'Lună sau cântare invalidă.'},{status:400});
 const supabase=await createClient();const {data,error}=await supabase.rpc('song_schedule_v52',{p_song_id:id,p_month:month+'-01',p_exclude_meeting:exclude||null});
 if(error)return Response.json({error:error.code==='42501'?'Autentificare necesară.':'Calendarul nu poate fi încărcat.'},{status:error.code==='42501'?401:503,headers:{'Cache-Control':'private, no-store'}});
 return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
}
