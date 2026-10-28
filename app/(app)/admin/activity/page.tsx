import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
export default async function ActivityPage({searchParams}:{searchParams:Promise<{page?:string;event?:string;actor?:string}>}){
 const p=await searchParams,page=Math.max(1,Math.min(100000,Number.parseInt(p.page||'1')||1));const {supabase}=await requireProfile('admin');
 let query=supabase.from('activity_log_v48').select('id,occurred_at,actor_email,event_type,resource_type,resource_id,path,details,transaction_id',{count:'exact'});
 if(p.event)query=query.eq('event_type',p.event.slice(0,80));if(p.actor)query=query.eq('actor_email',p.actor.slice(0,320));
 const {data,count,error}=await query.order('id',{ascending:false}).range((page-1)*50,page*50-1);
 const href=(n:number)=>{const q=new URLSearchParams({page:String(n)});if(p.event)q.set('event',p.event);if(p.actor)q.set('actor',p.actor);return '/admin/activity?'+q;};
 return <><div className="page-heading-v44"><div><div className="eyebrow">Administrare</div><h1>Jurnal de activitate</h1><p>Modificări, accesări, autentificări și acțiuni asupra programelor. Jurnalul nu conține parole.</p></div><Link className="btn secondary" href="/admin/users">Utilizatori</Link></div>
 <form className="inline-form"><label className="label">Eveniment<input className="input" name="event" defaultValue={p.event||''} placeholder="ex: update, auth.login"/></label><label className="label">Email utilizator<input className="input" name="actor" defaultValue={p.actor||''}/></label><button className="btn secondary">Filtrează</button><Link href="/admin/activity">Resetează</Link></form>
 {error?<p className="error">Rulează UPDATE-V48.sql pentru jurnalul de activitate.</p>:<><p className="muted small">{count||0} înregistrări · pagina {page}</p><div className="audit-list">{data?.map(row=><details className="card audit-row" key={row.id}><summary><time>{formatDateTime(row.occurred_at)}</time><strong>{row.actor_email||'Vizitator / sistem'}</strong><span className="badge">{row.event_type}</span><span>{row.resource_type||row.path||'Autentificare'}</span></summary><pre>{JSON.stringify({resursă:row.resource_id,tranzacție:row.transaction_id,...row.details},null,2)}</pre></details>)}</div><nav className="inline-form">{page>1?<Link href={href(page-1)}>← Mai recente</Link>:null}{(count||0)>page*50?<Link href={href(page+1)}>Mai vechi →</Link>:null}</nav></>}
 </>;
}
