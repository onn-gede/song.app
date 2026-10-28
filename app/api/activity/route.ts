import { requireProfile } from "@/lib/auth";
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length')||0)>2048)return new Response(null,{status:413});
  const text=await request.text();if(text.length>2048)return new Response(null,{status:413});
  const input=JSON.parse(text);if(input.event!=='program.print')return new Response(null,{status:400});
  const {supabase}=await requireProfile();const {error}=await supabase.rpc('record_activity_v48',{p_event:'program.print',p_path:typeof input.path==='string'?input.path.split('?')[0].slice(0,500):null});
  return new Response(null,{status:error?503:204});
 }catch{return new Response(null,{status:400});}
}
