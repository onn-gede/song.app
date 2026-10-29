"use client";
import {useRef,useState,useTransition,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
/** Keep submitted values until success; failed saves never reset the editor. */
export function SaveForm({action,children,className}:{action:(data:FormData)=>Promise<void>;children:ReactNode;className?:string}){
 const router=useRouter(),locked=useRef(false);
 const [pending,start]=useTransition(),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 return <form className={className} onChange={()=>setSaved(false)} onSubmit={event=>{
  event.preventDefault();if(locked.current)return;
  const data=new FormData(event.currentTarget);locked.current=true;setError('');setSaved(false);
  start(async()=>{try{await action(data);router.refresh();setSaved(true);}catch(e){setError(e instanceof Error?e.message:'Salvarea a eșuat.');}finally{locked.current=false;}});
 }} aria-busy={pending}><fieldset disabled={pending} className="save-form-fields">{children}</fieldset>{pending?<p role="status" className="small muted">Se salvează…</p>:null}{saved?<p role="status" className="small success">Salvat.</p>:null}{error?<p role="alert" className="error">{error}</p>:null}</form>;
}
