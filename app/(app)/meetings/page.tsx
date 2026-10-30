import Link from 'next/link';
import {requireProfile,canEdit} from '@/lib/auth';
import {Icon} from '@/components/Icon';
import {CreateMeetingModal} from '@/components/CreateMeetingModal';
import {MeetingsList} from '@/components/MeetingsList';
export default async function MeetingsPage({searchParams}:{searchParams:Promise<{templates?:string;upcoming?:string;finished?:string;all?:string}>}){
 const params=await searchParams,templates=params.templates==='1',finished=params.finished==='1'&&!templates,upcoming=!templates&&!finished&&params.all!=='1';
 const {supabase,profile}=await requireProfile();let query=supabase.from('meetings').select('id,title,meeting_type,meeting_date,status,is_template').eq('is_template',templates);if(upcoming)query=query.gt('meeting_date',new Date(Date.now()-7200000).toISOString()).neq('status','archived');const {data:meetings,error}=await query.order('meeting_date',{ascending:upcoming}).limit(200);
 return <div className="meetings-page-v44"><div className="page-heading-v44"><div><div className="eyebrow">Pregătește. Organizează. Cântă.</div><h1>{templates?'Șabloane de program':'Programele echipei'}</h1><p>{templates?'Un punct de plecare pentru întâlnirile care se repetă.':'Toate momentele întâlnirii, în ordinea potrivită.'}</p></div>{canEdit(profile.role)?<CreateMeetingModal/>:null}</div>
 <nav className="page-tabs-v44" aria-label="Tip listă programe"><Link href="/meetings" aria-current={upcoming?'page':undefined}>Urmează / în curs</Link><Link href="/meetings?all=1" aria-current={!templates&&!upcoming&&!finished?'page':undefined}>Toate programele</Link><Link href="/meetings?finished=1" aria-current={finished?'page':undefined}>Finalizate</Link><Link href="/meetings?templates=1" aria-current={templates?'page':undefined}><Icon name="copy" size={16}/>Șabloane</Link></nav>
 {error?<p className="error">Programele nu pot fi încărcate momentan.</p>:<MeetingsList meetings={meetings||[]} mode={templates?'templates':upcoming?'upcoming':finished?'finished':'all'} initialNow={Date.now()}/>}</div>;
}
