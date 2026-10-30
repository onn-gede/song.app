import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {createPublicClient} from '@/lib/supabase/public';
import {LoginForm} from '@/app/login/LoginForm';
import {signOutAction} from '@/app/login/actions';
import {PublicPrograms} from './PublicPrograms';
import {InstallApp} from './InstallApp';
import {Icon} from './Icon';
export async function WelcomePage(){
 const db=await createClient();let user=null;try{const result=await db.auth.getUser();user=result.data.user;}catch{}
 let inactive=false;if(user){const {data:profile}=await db.from('profiles').select('is_active').eq('id',user.id).maybeSingle();if(profile?.is_active)redirect('/dashboard');inactive=true;}
 const {data,error}=await createPublicClient().rpc('list_public_programs_v66',{p_page:1,p_page_size:4});
 return <main className="welcome-v66"><div className="welcome-stage"><div className="welcome-frame"><header className="welcome-brand"><span className="welcome-brand-mark"><Icon name="music" size={27}/></span><span><strong>SongApp<span>.</span></strong><small>BCB Giroc</small></span></header><div className="welcome-layout"><section className="welcome-login" aria-labelledby="welcome-login-heading"><div className="welcome-intro"><div className="welcome-intro-copy"><span className="welcome-kicker">Bine ai venit</span><h1>Împreună, în aceeași armonie.</h1><p>Cântările și programele comunității, într-un singur loc.</p></div></div>{inactive?<section className="welcome-inactive"><h2 id="welcome-login-heading">Acces în așteptare</h2><p>Contul nu are acces activ. Contactează un administrator sau urmărește un program public.</p><form action={signOutAction}><button className="btn" type="submit">Ieșire din cont</button></form></section>:<LoginForm welcome/>}<div className="welcome-team-note"><Icon name="users" size={17}/><span>Conturile echipei sunt aprobate de un administrator.</span></div></section><PublicPrograms initial={data||{total:0,page:1,pageSize:4,programs:[]}} failed={!!error}/></div><footer className="welcome-footer"><span>SongApp BCBgiroc</span><InstallApp/><span>Pregătim împreună momentele de închinare.</span></footer></div><picture className="welcome-photo" aria-hidden="true"><source media="(max-width: 800px)" srcSet="/images/bcb-giroc-welcome-v67-mobile.webp"/><img src="/images/bcb-giroc-welcome-v67-desktop.webp" width={800} height={1196} alt="" loading="lazy" decoding="async" fetchPriority="low"/></picture></div></main>;
}
