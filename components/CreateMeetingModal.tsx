"use client";
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useRef,useState,useTransition} from 'react';
import {createMeetingAction} from '@/app/(app)/meetings/actions';
import {MeetingDatePicker} from './MeetingDatePicker';
export function CreateMeetingModal(){
 const router=useRouter();const [open,setOpen]=useState(false),[pending,start]=useTransition(),[error,setError]=useState(''),[created,setCreated]=useState('');const locked=useRef(false),token=useRef(''),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 function close(){if(!locked.current)setOpen(false);}
 useEffect(()=>{if(!open)return;const element=dialog.current;element?.showModal();return()=>{element?.close();trigger.current?.focus({preventScroll:true});};},[open]);
 return <><button ref={trigger} className="btn" type="button" onClick={()=>{token.current=crypto.randomUUID();setError('');setCreated('');setOpen(true);}}>+ Creează program nou</button>{open?<dialog ref={dialog} className="dialog modal-card create-meeting-dialog" aria-labelledby="create-meeting-title" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===dialog.current)close();}}><div className="modal-header"><h2 id="create-meeting-title">Program nou</h2><button className="icon-btn" type="button" disabled={pending||!!created} onClick={close} aria-label="Închide">×</button></div>
 <form className="form-grid" onSubmit={event=>{event.preventDefault();if(locked.current)return;locked.current=true;setError('');const data=new FormData(event.currentTarget);data.set('request_id',token.current);start(async()=>{try{const id=await createMeetingAction(data);setCreated(id);router.push(`/meetings/${id}`);}catch(e){locked.current=false;setError(e instanceof Error?e.message:'Nu am putut crea programul. Încearcă din nou.');}});}}>
 <label className="label">Titlu<input className="input" name="title" placeholder="Duminică dimineața" required maxLength={200} autoFocus disabled={pending||!!created}/></label>
 <fieldset className="program-kind-picker" disabled={pending||!!created}><legend>Tip program</legend><label><input type="radio" name="program_kind" value="official" defaultChecked/> <span><strong>Program oficial</strong><small>Intră în istoricul și statisticile cântărilor.</small></span></label><label><input type="radio" name="program_kind" value="rehearsal"/> <span><strong>Repetiție</strong><small>Cântările nu se numără ca fiind cântate.</small></span></label></fieldset>
 <MeetingDatePicker disabled={pending||!!created}/>
 <details className="meeting-create-options"><summary>Tip întâlnire și observații</summary><label className="label">Tip întâlnire<input className="input" name="meeting_type" placeholder="Închinare, tineret, rugăciune" maxLength={100}/></label><label className="label">Observații<textarea className="textarea" name="notes"/></label></details>
 {error?<p className="error" role="alert">{error}</p>:null}{created?<p className="success" role="status">Program creat. <Link href={`/meetings/${created}`}>Deschide programul</Link></p>:null}
 <div className="inline-form modal-actions"><button className="btn" type="submit" disabled={pending||!!created}>{created?'Se deschide…':pending?'Se creează…':'Creează program'}</button><button className="btn secondary" type="button" disabled={pending||!!created} onClick={close}>Renunță</button></div></form></dialog>:null}</>;
}
