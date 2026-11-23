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
export async function updateManagedUserAction(id:string,name:string,role:string,active:boolean){
 const {supabase}=await requireProfile('admin');
 name=name.trim();if(!name||name.length>120)throw new Error('Numele de utilizator este obligatoriu și poate avea maximum 120 de caractere.');
 if(!['admin','editor','worship_leader','viewer'].includes(role)||typeof active!=='boolean')throw new Error('Rol invalid.');
 const {error}=await supabase.rpc('admin_update_profile_v80',{p_id:id,p_name:name,p_role:role,p_active:active});
 if(error)throw new Error(error.message);revalidatePath('/admin/users');revalidatePath('/meetings','layout');refresh();return users();
}

export async function moderateManagedUserAction(id:string,remove:boolean){
 const {supabase}=await requireProfile('admin');const {error}=await supabase.rpc('admin_moderate_user_v57',{p_id:id,p_remove:remove});if(error)throw new Error(error.message);revalidatePath('/admin/users');refresh();return users();
}

export async function resetManagedUserPasswordAction(id:string,password:string,confirmation:string){
 const {supabase,user,profile}=await requireProfile('admin');
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Utilizator invalid.');
 if(password.length<12||password.length>128||password!==confirmation)throw new Error('Parola temporară trebuie să aibă minimum 12 caractere și să fie confirmată identic.');
 const {data:target,error:targetError}=await supabase.from('profiles').select('id,email,full_name').eq('id',id).maybeSingle();
 if(targetError||!target)throw new Error('Contul nu a fost găsit.');
 const admin=createAdminClient();
 const {error}=await admin.auth.admin.updateUserById(id,{password});
 if(error){await logAuthFailure('admin.password_reset_failure',target.email||id);throw new Error('Parola nu a putut fi resetată.');}
 const {error:auditError}=await admin.from('activity_log_v48').insert({actor_id:user.id,actor_email:profile.email,event_type:'admin.password_reset',resource_type:'profiles',resource_id:id,path:'/admin/users',details:{resource_label:target.full_name||target.email||'Utilizator',self_reset:id===user.id}});
 if(auditError)console.warn('Password reset audit unavailable');
 return {ok:true};
}
