import {createClient} from '@/lib/supabase/server';
export async function GET(request:Request){
 const query=new URL(request.url).searchParams.get('q')?.trim().slice(0,160)||'';
 const excluded=new URL(request.url).searchParams.get('exclude');
 if(excluded&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(excluded))return Response.json({error:'Program invalid.'},{status:400});
 const params=new URL(request.url).searchParams;const filters={p_collection:params.get('collection')||null,p_category:params.get('category')||null,p_key:params.get('key')||null};if([filters.p_collection,filters.p_category].some(x=>x&&!/^[0-9a-f-]{36}$/i.test(x)))return Response.json({error:'Filtru invalid.'},{status:400});
 const supabase=await createClient();
 // Database checks the JWT's active profile and records the search in the same request.
 const {data,error}=await supabase.rpc('search_program_songs_v62',{...filters,p_query:query,p_limit:30,p_exclude_meeting:excluded||null});
 if(error)return Response.json({error:error.code==='42501'?'Autentificare necesară.':'Căutarea nu este disponibilă momentan.'},{status:error.code==='42501'?401:503,headers:{'Cache-Control':'private, no-store'}});
 return Response.json(data||[],{headers:{'Cache-Control':'private, no-store'}});
}
