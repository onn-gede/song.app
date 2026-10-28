import Link from "next/link";
import { requireProfile,canEdit } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { CreateMeetingModal } from "@/components/CreateMeetingModal";
export default async function DashboardPage() {
 const {supabase,profile}=await requireProfile(),editable=canEdit(profile.role);
 const [{count:songsCount},{count:meetingsCount},{count:collectionsCount},{count:reviewCount},{data:recentUsage},{data:recentMeetings},{data:next}]=await Promise.all([
  supabase.from("songs").select("id",{count:"exact",head:true}).eq("is_active",true),
  supabase.from("meetings").select("id",{count:"exact",head:true}).eq("is_template",false),
  supabase.from("song_collections").select("id",{count:"exact",head:true}).eq("is_active",true),
  supabase.from("song_files").select("id",{count:"exact",head:true}).eq("import_status","needs_review"),
  supabase.rpc("get_song_recent_usage",{days_back:30}).limit(5),
  supabase.from("meetings").select("id,title,meeting_date,status").eq("is_template",false).order("meeting_date",{ascending:false}).limit(4),
  supabase.from("meetings").select("id,title,meeting_date").eq("is_template",false).gte("meeting_date",new Date().toISOString()).neq("status","archived").order("meeting_date").limit(1).maybeSingle()
 ]);
 const firstName=String(profile.full_name||"").split(/\s+/)[0];
 const stats=[{label:"Cântări în bibliotecă",value:songsCount||0,href:"/songs",icon:"music"},{label:"Programe pregătite",value:meetingsCount||0,href:"/meetings",icon:"calendar"},{label:"Colecții active",value:collectionsCount||0,href:"/collections",icon:"folder"},...(editable?[{label:"Importuri de verificat",value:reviewCount||0,href:"/review",icon:"check"}]:[])];
 return <div className="dashboard-v44"><div className="page-heading-v44"><div><div className="eyebrow">Bine ai revenit{firstName?`, ${firstName}`:""}</div><h1>Pregătim următorul program?</h1><p>Cântările, colecțiile și întâlnirile echipei, într-un singur loc.</p></div>{editable?<CreateMeetingModal/>:null}</div>
  <div className="dashboard-feature-grid"><section className="next-program-feature"><div className="feature-kicker"><Icon name="calendar" size={17}/>{next?"Următorul program":"Programele echipei"}</div><h2>{next?.title||"Un program bun începe cu o cântare."}</h2><p>{next?formatDateTime(next.meeting_date):"Alege cântările și organizează momentele întâlnirii."}</p><div className="inline-form"><Link href={next?`/meetings/${next.id}`:"/meetings"} className="feature-primary">{next?"Deschide programul":"Vezi programele"}<Icon name="arrow" size={18}/></Link>{next?<Link className="feature-secondary" href={`/meetings/${next.id}/present`}><Icon name="play" size={16}/>Prezintă</Link>:null}</div><Icon name="music" size={150} className="feature-watermark"/></section>
   <Link href="/songs" className="library-feature-card"><span className="feature-icon"><Icon name="search" size={25}/></span><h2>Găsește cântarea potrivită.</h2><p>Caută după titlu, versuri sau număr și filtrează după colecție și tematică.</p><span className="text-link-v44">Explorează biblioteca<Icon name="arrow" size={17}/></span></Link>
  </div>
  <section className="dashboard-stats-v44" aria-label="Statistici aplicație">{stats.map(s=><Link href={s.href} className="dashboard-stat-v44" key={s.label}><Icon name={s.icon} size={20}/><strong>{s.value.toLocaleString("ro-RO")}</strong><span>{s.label}</span></Link>)}</section>
  <div className="dashboard-lists-v44"><section className="surface-v44"><div className="surface-heading"><div><span className="eyebrow">Organizare</span><h2>Programe recente</h2></div><Link href="/meetings" className="text-link-v44">Vezi toate<Icon name="arrow" size={16}/></Link></div>{recentMeetings?.length?recentMeetings.map(m=><Link key={m.id} href={`/meetings/${m.id}`} className="dashboard-list-row"><span className="small-calendar"><Icon name="calendar"/></span><span><strong>{m.title}</strong><small>{formatDateTime(m.meeting_date)}</small></span><Icon name="chevron" size={18}/></Link>):<p className="surface-empty">Programele create vor apărea aici.</p>}</section>
   <section className="surface-v44"><div className="surface-heading"><div><span className="eyebrow">Repertoriu</span><h2>Cântate recent</h2></div><span className="muted small">Ultimele 30 de zile</span></div>{recentUsage?.length?recentUsage.map((s:any)=><Link key={s.song_id} href={`/songs/${s.song_id}`} className="dashboard-list-row"><span className="small-music"><Icon name="music"/></span><span><strong>{s.title}</strong><small>{s.last_meeting_title||formatDateTime(s.last_used_at)}</small></span><span className="usage-pill">{s.times_used}×</span></Link>):<p className="surface-empty">Cântările folosite în programe vor apărea aici.</p>}</section>
  </div>
  {editable?<Link className="dashboard-import-banner" href="/import"><span className="feature-icon"><Icon name="upload"/></span><span><strong>Ai descoperit o cântare nouă?</strong><small>Importă dintr-un link, fișier sau text. Verifică versurile, apoi alege colecția.</small></span><span className="text-link-v44">Importă o cântare<Icon name="arrow" size={18}/></span></Link>:null}
 </div>;
}
