"use client";
import {useEffect,useRef,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {MeetingDatePicker} from "./MeetingDatePicker";
import {updateMeetingDetailsAction} from "@/app/(app)/meetings/actions";

type Meeting={id:string;title:string;meeting_type:string|null;meeting_date:string;notes:string|null;program_kind:string};
export function EditMeetingModal({meeting}:{meeting:Meeting}){
 const router=useRouter(),dialog=useRef<HTMLDialogElement>(null);const [open,setOpen]=useState(false),[pending,start]=useTransition(),[error,setError]=useState("");
 useEffect(()=>{if(!open)return;dialog.current?.showModal();return()=>dialog.current?.close();},[open]);
 return <><button className="btn secondary" type="button" onClick={()=>{setError("");setOpen(true);}}>Editează întâlnirea</button>{open?<dialog ref={dialog} className="dialog modal-card edit-meeting-dialog" onCancel={event=>{event.preventDefault();if(!pending)setOpen(false);}} onClick={event=>{if(event.target===dialog.current&&!pending)setOpen(false);}}>
  <div className="modal-header"><div><div className="eyebrow">Detalii program</div><h2>Editează întâlnirea</h2></div><button className="icon-btn" type="button" disabled={pending} onClick={()=>setOpen(false)} aria-label="Închide">×</button></div>
  <form className="form-grid" onSubmit={event=>{event.preventDefault();setError("");const data=new FormData(event.currentTarget);start(async()=>{try{await updateMeetingDetailsAction(data);setOpen(false);router.refresh();}catch(e){setError(e instanceof Error?e.message:"Modificarea nu a putut fi salvată.");}});}}>
   <input type="hidden" name="meeting_id" value={meeting.id}/>
   <label className="label">Titlu<input className="input" name="title" defaultValue={meeting.title} required maxLength={200}/></label>
   <fieldset className="program-kind-picker" disabled={pending}><legend>Tip program</legend><label><input type="radio" name="program_kind" value="official" defaultChecked={meeting.program_kind!=="rehearsal"}/><span><strong>Program oficial</strong><small>Intră în istoricul cântărilor.</small></span></label><label><input type="radio" name="program_kind" value="rehearsal" defaultChecked={meeting.program_kind==="rehearsal"}/><span><strong>Repetiție</strong><small>Nu intră în istoric sau statistici.</small></span></label></fieldset>
   <MeetingDatePicker initialValue={meeting.meeting_date} disabled={pending}/>
   <label className="label">Tip întâlnire<input className="input" name="meeting_type" defaultValue={meeting.meeting_type||""} maxLength={100} placeholder="Închinare, tineret, rugăciune"/></label>
   <label className="label">Observații<textarea className="textarea" name="notes" defaultValue={meeting.notes||""} maxLength={5000}/></label>
   {error?<p className="error" role="alert">{error}</p>:null}<div className="inline-form modal-actions"><button className="btn" disabled={pending}>{pending?"Se salvează…":"Salvează modificările"}</button><button className="btn secondary" type="button" disabled={pending} onClick={()=>setOpen(false)}>Renunță</button></div>
  </form>
 </dialog>:null}</>;
}
