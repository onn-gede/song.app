import "server-only";
import { createClient } from "@supabase/supabase-js";
export function createAdminClient() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Administrarea conturilor necesită configurarea cheii private pe server.");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function logAuthFailure(event: string,email: string) {
  try{const {error}=await createAdminClient().rpc("record_auth_failure_v48",{p_event:event,p_email:email});if(error)console.warn("Auth audit unavailable");}catch{console.warn("Auth audit unavailable");}
}
