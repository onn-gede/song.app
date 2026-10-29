"use client";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useMeetingState} from './MeetingState';
import {Icon} from "./Icon";
import {formatDateTime} from '@/lib/format';
export type ProgramProposal={id:string;contribution_type:string;custom_title:string|null;custom_text:string|null;is_backup:boolean;proposed_position:number|null;contributor_name:string|null;notes:string|null;created_at:string;songs:{id:string;title:string;default_key:string|null}|{id:string;title:string;default_key:string|null}[]|null};
type Notices={items:ProgramProposal[];open:boolean;toggle:()=>void;busy:string|null;error:string;refresh:()=>Promise<void>;decide:(id:string,accept:boolean)=>Promise<void>};
const Context=createContext<Notices|null>(null);
export function ProgramNotifications({meetingId,initial,children,enabled=true}:{enabled?:boolean;meetingId:string;initial:ProgramProposal[];children:ReactNode}){
 const state=useMeetingState(),[items,setItems]=useState(initial),[open,setOpen]=useState(false),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 const locked=useRef(false),generation=useRef(0),alive=useRef(true),polling=useRef(false);
 const endpoint=`/api/meetings/${meetingId}/live`;
 async function refresh(){
  if(locked.current||polling.current)return;const g=generation.current;polling.current=true;
  try{const r=await fetch(endpoint,{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error||'Verificarea propunerilor a eșuat.');if(alive.current&&g===generation.current){setItems(data.pending);setError('');}}
  catch(e){if(alive.current&&g===generation.current)setError(e instanceof Error?e.message:'Verificarea a eșuat.');}finally{polling.current=false;}
 }
 useEffect(()=>{if(!enabled)return;alive.current=true;const check=()=>{if(!document.hidden)void refresh();};const timer=setInterval(check,15000);document.addEventListener('visibilitychange',check);window.addEventListener('online',check);return()=>{alive.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',check);window.removeEventListener('online',check);};},[meetingId,enabled]); // eslint-disable-line react-hooks/exhaustive-deps
 async function decide(id:string,accept:boolean){
  if(locked.current)return;locked.current=true;generation.current++;setBusy(id);setError('');
  try{const r=await fetch(endpoint,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'review',contributionId:id,accept})}),data=await r.json();if(!r.ok)throw Error(data.error||'Propunerea nu a fost procesată.');if(alive.current){state?.apply(data.snapshot);setItems(data.pending);}}
  catch(e){if(alive.current)setError(e instanceof Error?e.message:'Salvarea a eșuat.');}finally{locked.current=false;if(alive.current)setBusy(null);}
 }
 return <Context.Provider value={{items,open,toggle:()=>setOpen(v=>!v),busy,error,refresh,decide}}>{children}</Context.Provider>;
}
export function ProgramNotificationsButton(){
 const c=useContext(Context);if(!c)return null;
 return <button type="button" className={'btn program-notifications-button'+(c.items.length?' has-pending':'')} aria-expanded={c.open} aria-controls="program-notifications" onClick={()=>{c.toggle();if(!c.open)void c.refresh();}} title={c.error?'Verifică notificările':undefined}><Icon name="bell" size={16}/> Notificări <span className="notification-count">{c.items.length}</span>{c.error?<span aria-label="Verificare indisponibilă">!</span>:null}</button>;
}
export function ProgramNotificationsPanel(){
 const c=useContext(Context);if(!c)return null;
 const labels:Record<string,string>={prayer:'Rugăciune',text:'Poezie',message:'Mesaj',encouragement:'Îndemn',break:'Pauză',other:'Diverse',song:'Cântare'};
 return <section id="program-notifications" className="program-notifications-panel print-hide" hidden={!c.open} aria-labelledby="program-notifications-title"><div className="top-row"><h2 id="program-notifications-title">Notificări și propuneri <span className="notification-count">{c.items.length}</span></h2><button type="button" className="quiet-button" onClick={()=>void c.refresh()}>Actualizează</button></div>
 {c.error?<p className="error" role="alert">{c.error}</p>:null}{!c.items.length?<p className="muted">Nu sunt propuneri în așteptare.</p>:null}
 <div className="notification-proposals">{c.items.map(item=>{const song=Array.isArray(item.songs)?item.songs[0]:item.songs;return <article className="external-proposal-card" key={item.id}><div><h3>{song?.title||item.custom_title||labels[item.contribution_type]||'Propunere'}</h3><div className="badges compact-badges"><span className="badge">{labels[item.contribution_type]||'Moment'}</span>{item.contributor_name?<span className="badge">{item.contributor_name}</span>:null}{item.is_backup?<span className="badge">Backup</span>:null}{item.proposed_position?<span className="badge">Poziția {item.proposed_position}</span>:null}</div>{item.custom_text?<p className="program-moment-observations">{item.custom_text}</p>:null}{item.notes?<p className="program-moment-observations">{item.notes}</p>:null}<small className="muted">{formatDateTime(item.created_at)}</small></div><div className="inline-form"><button type="button" className="btn btn-compact" disabled={!!c.busy} onClick={()=>void c.decide(item.id,true)}>{c.busy===item.id?'Se salvează…':'Acceptă'}</button><button type="button" className="btn secondary btn-compact" disabled={!!c.busy} onClick={()=>void c.decide(item.id,false)}>Respinge</button></div></article>;})}</div></section>;
}
