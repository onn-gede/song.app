import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { AdminUserManager } from "@/components/AdminUserManager";
export default async function UsersPage(){
 const {supabase,user}=await requireProfile('admin');const {data,error}=await supabase.from('profiles').select('id,email,full_name,role,is_active,created_at,updated_at').order('created_at',{ascending:false}).limit(200);
 return <><div className="page-heading-v44"><div><div className="eyebrow">Administrare</div><h1>Conturi și aprobări</h1><p>Administratorii creează conturi, aprobă accesul și aleg rolurile.</p></div><Link className="btn secondary" href="/admin/activity">Vezi activitatea</Link></div>{error?<p className="error">Conturile nu pot fi încărcate.</p>:<AdminUserManager initial={data||[]} currentId={user.id} canCreate={!!process.env.SUPABASE_SERVICE_ROLE_KEY}/>}</>;
}
