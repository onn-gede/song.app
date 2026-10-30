import {createPublicClient} from "@/lib/supabase/public";
export async function POST(_request:Request,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;if(!slug||slug.length>200)return new Response(null,{status:404});
 const supabase=createPublicClient();const {data,error}=await supabase.rpc('record_public_view_v48',{p_slug:slug,p_event:'public.print'});
 return new Response(null,{status:error?503:data?204:404});
}
