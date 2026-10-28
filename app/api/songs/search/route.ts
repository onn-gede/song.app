import {createClient} from '@/lib/supabase/server';
export async function GET(request:Request){
 const query=new URL(request.url).searchParams.get('q')?.trim().slice(0,160)||'';
 const supabase=await createClient();
 // Database checks the JWT's active profile and records the search in the same request.
 const {data,error}=await supabase.rpc('search_program_songs_v49',{p_query:query,p_limit:8});
 if(error)return Response.json({error:error.code==='42501'?'Autentificare necesară.':'Căutarea nu este disponibilă momentan.'},{status:error.code==='42501'?401:503,headers:{'Cache-Control':'private, no-store'}});
 return Response.json(data||[],{headers:{'Cache-Control':'private, no-store'}});
}
