import { requireProfile } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
export default async function AccountPage(){const {profile}=await requireProfile();return <div style={{maxWidth:560}}><div className="page-heading-v44"><div><div className="eyebrow">Contul meu</div><h1>{profile.full_name||profile.email}</h1><p>Schimbă parola contului tău.</p></div></div><ChangePasswordForm/></div>;}
