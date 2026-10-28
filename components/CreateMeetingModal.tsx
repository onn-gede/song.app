"use client";
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useRef,useState,useTransition} from 'react';
import {createMeetingAction} from '@/app/(app)/meetings/actions';
import {MeetingDatePicker} from './MeetingDatePicker';
export function CreateMeetingModal(){
 const router=useRouter();const [open,setOpen]=useState(false),[pending,start]=useTransition(),[error,setError]=useState(''),[created,setCreated]=useState('');const locked=useRef(false),token=useRef('');
 function close(){if(!locked.current)setOpen(false);}
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[open]);
 return <><button className="btn" type="button" onClick={()=>{token.current=crypto.randomUUID();setError('');setCreated('');setOpen(true);}}>+ Creează program nou</button>{open?<div className="dialog-backdrop" role="presentation" onMouseDown={close}><div className="dialog modal-card" role="dialog" aria-modal="true" aria-labelledby="create-meeting-title" onMouseDown={e=>e.stopPropagation()}><div className="modal-header"><h2 id="create-meeting-title">Program nou</h2><button className="icon-btn" type="button" disabled={pending||!!created} onClick={close} aria-label="Închide">×</button></div>
 <form className="form-grid" onSubmit={event=>{event.preventDefault();if(locked.current)return;locked.current=true;setError('');const data=new FormData(event.currentTarget);data.set('request_id',token.current);start(async()=>{try{const id=await createMeetingAction(data);setCreated(id);router.push(`/meetings/${id}`);}catch(e){locked.current=false;setError(e instanceof Error?e.message:'Nu am putut crea programul. Încearcă din nou.');}});}}>
 <label className="label">Titlu<input className="input" name="title" placeholder="Duminică dimineața" required maxLength={200} autoFocus disabled={pending||!!created}/></label>
 <MeetingDatePicker disabled={pending||!!created}/>
 <details className="meeting-create-options"><summary>Tip întâlnire și observații</summary><label className="label">Tip întâlnire<input className="input" name="meeting_type" placeholder="Închinare, tineret, rugăciune" maxLength={100}/></label><label className="label">Observații<textarea className="textarea" name="notes"/></label></details>
 {error?<p className="error" role="alert">{error}</p>:null}{created?<p className="success" role="status">Program creat. <Link href={`/meetings/${created}`}>Deschide programul</Link></p>:null}
 <div className="inline-form modal-actions"><button className="btn" type="submit" disabled={pending||!!created}>{created?'Se deschide…':pending?'Se creează…':'Creează program'}</button><button className="btn secondary" type="button" disabled={pending||!!created} onClick={close}>Renunță</button></div></form></div></div>:null}</>;
}
