"use server";
import { revalidatePath,refresh } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient,logAuthFailure } from "@/lib/supabase/admin";
export type ManagedUser={id:string;email:string|null;full_name:string|null;role:string;is_active:boolean;created_at:string;moderation_state?:string;updated_at?:string};
async function users(){const {supabase}=await requireProfile("admin");const {data,error}=await supabase.from("profiles").select("id,email,full_name,role,is_active,created_at,updated_at,moderation_state").neq("moderation_state","hidden").order("created_at",{ascending:false}).limit(200);if(error)throw new Error(error.message);return (data||[]) as ManagedUser[];}
export async function createManagedUserAction(data:FormData){
 const {supabase}=await requireProfile("admin");
 const email=String(data.get('email')||'').trim().toLowerCase(),name=String(data.get('full_name')||'').trim(),password=String(data.get('password')||''),role=String(data.get('role')||'viewer');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>320||name.length>120||password.length<12||password.length>128||!['admin','editor','worship_leader','viewer'].includes(role))throw new Error("Completează emailul, numele și o parolă de minimum 12 caractere.");
 const admin=createAdminClient();
 const {data:created,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
 if(error||!created.user){await logAuthFailure('admin.create_failure',email);throw new Error(error?.message||'Contul nu a putut fi creat.');}
 const {error:profileError}=await supabase.rpc('admin_set_profile_v48',{p_id:created.user.id,p_role:role,p_active:false});
 revalidatePath('/admin/users');refresh();
 if(profileError)throw new Error('Contul este în așteptare. Verifică rolul în lista de utilizatori.');
 return users();
}
export async function updateManagedUserAction(id:string,role:string,active:boolean){
 const {supabase}=await requireProfile('admin');
 if(!['admin','editor','worship_leader','viewer'].includes(role)||typeof active!=='boolean')throw new Error('Rol invalid.');
 const {error}=await supabase.rpc('admin_set_profile_v48',{p_id:id,p_role:role,p_active:active});
 if(error)throw new Error(error.message);revalidatePath('/admin/users');refresh();return users();
}

export async function moderateManagedUserAction(id:string,remove:boolean){
 const {supabase}=await requireProfile('admin');const {error}=await supabase.rpc('admin_moderate_user_v57',{p_id:id,p_remove:remove});if(error)throw new Error(error.message);revalidatePath('/admin/users');refresh();return users();
}
