import Link from "next/link";
import { meetingStatus, bucharestDayStart } from "@/lib/meeting-state";
import { requireProfile,canEdit } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import { CreateMeetingModal } from "@/components/CreateMeetingModal";
export default async function MeetingsPage({searchParams}:{searchParams:Promise<{templates?:string;upcoming?:string;finished?:string}>}) {
 const params=await searchParams,templates=params.templates==="1",upcoming=params.upcoming==="1"&&!templates,finished=params.finished==="1"&&!templates&&!upcoming;
 const {supabase,profile}=await requireProfile();
 let query=supabase.from("meetings").select("id,title,meeting_type,meeting_date,status,is_template").eq("is_template",templates);
 if(upcoming)query=query.gte("meeting_date",bucharestDayStart(new Date())).neq("status","archived");
 if(finished)query=query.lt("meeting_date",bucharestDayStart(new Date())).neq("status","archived");
 const {data:meetings,error}=await query.order("meeting_date",{ascending:upcoming}).limit(100);
 const statusLabels:Record<string,string>={draft:"În pregătire",ready:"Pregătit",archived:"Arhivat",finished:"Finalizat",template:"Șablon"};
 return <div className="meetings-page-v44"><div className="page-heading-v44"><div><div className="eyebrow">Pregătește. Organizează. Cântă.</div><h1>{templates?"Șabloane de program":"Programele echipei"}</h1><p>{templates?"Un punct de plecare bun pentru întâlnirile care se repetă.":"Toate momentele întâlnirii, în ordinea potrivită."}</p></div>{canEdit(profile.role)?<CreateMeetingModal/>:null}</div>
  <nav className="page-tabs-v44" aria-label="Tip listă programe"><Link href="/meetings" aria-current={!templates&&!upcoming&&!finished?"page":undefined}>Toate programele</Link><Link href="/meetings?upcoming=1" aria-current={upcoming?"page":undefined}>Urmează</Link><Link href="/meetings?finished=1" aria-current={finished?"page":undefined}>Finalizate</Link><Link href="/meetings?templates=1" aria-current={templates?"page":undefined}><Icon name="copy" size={16}/>Șabloane</Link></nav>
  <div className="results-caption-v44"><span>{templates?"Șabloane reutilizabile":upcoming?"Întâlniri viitoare":finished?"Programe finalizate":"Programe existente"}</span><small>{meetings?.length||0} {templates?"șabloane":"programe"}</small></div>
  {error?<p className="error">Programele nu pot fi încărcate momentan.</p>:null}
  <div className="meeting-cards-v44">{meetings?.map(m=>{
   const date=new Date(m.meeting_date),status=meetingStatus(m.meeting_date,m.status,templates);return <Link href={`/meetings/${m.id}`} key={m.id} className="meeting-card-v44"><div className="meeting-card-top"><span className={`meeting-date-tile${templates?" is-template":""}`}>{templates?<Icon name="copy" size={26}/>:<><small>{date.toLocaleDateString("ro-RO",{month:"short",timeZone:"Europe/Bucharest"}).replace(".","")}</small><strong>{date.toLocaleDateString("ro-RO",{day:"2-digit",timeZone:"Europe/Bucharest"})}</strong></>}</span><span className={`meeting-status status-${status}`}><i/>{statusLabels[status]||status}</span></div><h2>{m.title}</h2><p>{templates?"Șablon pentru un program nou":date.toLocaleDateString("ro-RO",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Bucharest"})+" · "+date.toLocaleTimeString("ro-RO",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Bucharest"})}</p><div className="meeting-card-bottom"><span>{m.meeting_type?.replace(/_/g," ")||"Întâlnire"}</span><Icon name="arrow" size={18}/></div></Link>;
  })}</div>
  {!error&&!meetings?.length?<div className="empty-state-v44"><span><Icon name="calendar" size={32}/></span><h2>{templates?"Primul tău șablon":"Niciun program aici, deocamdată"}</h2><p>{templates?"Deschide un program existent și păstrează-l ca șablon.":"Creează o întâlnire și alege cântările din bibliotecă."}</p></div>:null}
 </div>;
}
