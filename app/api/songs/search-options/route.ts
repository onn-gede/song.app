import {requireProfile} from '@/lib/auth';
export async function GET(){try{const {supabase}=await requireProfile();const {data,error}=await supabase.rpc('program_search_filters_v62');if(error)throw error;return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'Filtre indisponibile.'},{status:403});}}
