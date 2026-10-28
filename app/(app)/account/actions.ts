"use server";
import { requireProfile } from "@/lib/auth";
export async function changePasswordAction(data:FormData){
 const {supabase,user}=await requireProfile();const current=String(data.get('current_password')||''),password=String(data.get('new_password')||'');
 if(password.length<12||password.length>128||password!==String(data.get('confirm_password')||''))throw new Error('Parola nouă trebuie să aibă minimum 12 caractere și să fie confirmată identic.');
 const verified=await supabase.auth.signInWithPassword({email:user.email!,password:current});if(verified.error)throw new Error('Parola actuală nu este corectă.');
 const {error}=await supabase.auth.updateUser({password});if(error)throw new Error('Parola nu a putut fi schimbată.');
 await supabase.rpc('record_activity_v48',{p_event:'account.password',p_path:'/account'});
}
