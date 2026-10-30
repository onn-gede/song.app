import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { signOutAction } from "@/app/login/actions";
import { AppNavigation } from "@/components/AppNavigation";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { Icon } from "@/components/Icon";
// Private pages depend on the current authenticated request.
export const dynamic = 'force-dynamic';
export default async function AppLayout({children}:{children:React.ReactNode}) {
 let context;try{context=await requireProfile();}catch{redirect("/login");}
 const {profile,user}=context;
 const name=profile.full_name||profile.email||user.email||"Utilizator";
 const initials=String(name).split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0].toUpperCase()).join("");
 const roles:Record<string,string>={admin:"Administrator",editor:"Editor",worship_leader:"Coordonator",viewer:"Vizualizare"};
 return <WorkspaceShell sidebar={<>
  <Link href="/dashboard" className="workspace-brand" aria-label="SongApp BCBgiroc · Acasă"><span className="workspace-brand-mark"><Icon name="music" size={25}/></span><span><strong>SongApp<span className="brand-period">.</span></strong><small>BCBgiroc</small></span></Link>
  <AppNavigation role={profile.role} showExternalSync={process.env.ENABLE_EXTERNAL_SYNC==="true"}/>
  <div className="workspace-sidebar-note"><Icon name="music" size={28}/><p>Mai puțin timp de pregătire.<br/><strong>Mai mult loc pentru muzică.</strong></p></div>
  <div className="workspace-user"><span className="workspace-avatar">{initials}</span><span className="workspace-user-copy"><strong><Link href="/account">{name}</Link></strong><small>{roles[profile.role]||profile.role}</small></span><form action={signOutAction}><button type="submit" aria-label="Ieșire din cont" title="Ieșire din cont" className="workspace-logout"><Icon name="logout" size={18}/></button></form></div>
 </>}>{children}</WorkspaceShell>;
}
