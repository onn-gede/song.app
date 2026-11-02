'use client';
import {useEffect,useRef,useState,useId} from 'react';
import {createPortal} from 'react-dom';
import {requestJson} from '@/lib/client-request';
type Preview={first_verse?:string|null;chorus?:string|null;verse_count?:number|null};

export function SongLyricsTooltip({songId,title,preview}:{songId:string;title:string;preview?:Preview}){
 const tooltipId=useId(),button=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null);
 const loaded=useRef(false),abort=useRef<AbortController|null>(null),hide=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const [open,setOpen]=useState(false),[pinned,setPinned]=useState(false),[data,setData]=useState<Preview|undefined>(preview),[error,setError]=useState(''),[pos,setPos]=useState({top:0,left:0});
 const close=()=>{clearTimeout(hide.current);setOpen(false);setPinned(false);};
 useEffect(()=>()=>{abort.current?.abort();clearTimeout(hide.current);},[]);
 useEffect(()=>{if(!open||!pinned)return;const element=dialog.current;element?.showModal();return()=>element?.close();},[open,pinned]);
 function show(){
  clearTimeout(hide.current);
  const rect=button.current?.getBoundingClientRect();if(rect)setPos({left:Math.max(8,Math.min(rect.left,window.innerWidth-350)),top:Math.max(8,Math.min(rect.bottom+8,window.innerHeight-220))});
  setOpen(true);if(preview||loaded.current)return;
  loaded.current=true;setError('');const controller=new AbortController();abort.current=controller;
  requestJson<Preview>(`/api/songs/${songId}/preview`,{signal:controller.signal,cache:'no-store'}).then(setData).catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Preview indisponibil.');loaded.current=false;}});
 }
 const later=()=>{if(!pinned)hide.current=setTimeout(()=>setOpen(false),150);};
 useEffect(()=>{if(!open||pinned)return;
  const scrolled=(event:Event)=>{if(event.target instanceof Node&&popup.current?.contains(event.target))return;setOpen(false);};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
  window.addEventListener('scroll',scrolled,true);window.addEventListener('keydown',key);
  return()=>{window.removeEventListener('scroll',scrolled,true);window.removeEventListener('keydown',key);};
 },[open,pinned]);
 const content=<><strong id={tooltipId+'-title'}>{title}</strong>{error?<p role="alert">{error}</p>:!data?<p role="status">Se încarcă…</p>:<>{data.first_verse?<><small>Prima strofă</small><pre>{data.first_verse}</pre></>:<p>Versurile nu sunt disponibile. Pentru cântările PPT/PDF, deschide prezentarea atașată.</p>}{data.chorus?<><small>Refren</small><pre>{data.chorus}</pre></>:data.first_verse?<small>Refrenul nu este identificat separat.</small>:null}</>}</>;
 return <span className="song-preview-trigger" onMouseEnter={show} onMouseLeave={later}>
  <button ref={button} type="button" className="quiet-button" aria-label={`Preview versuri: ${title}`} aria-expanded={open} aria-describedby={open&&!pinned?tooltipId:undefined} onFocus={show} onBlur={()=>{if(!pinned)setOpen(false);}} onClick={()=>{if(window.matchMedia('(hover: none)').matches)setPinned(true);show();}}>Versuri ⓘ</button>
  {open&&typeof document!=='undefined'?createPortal(pinned?<dialog ref={dialog} className="song-lyrics-touch-dialog" aria-labelledby={tooltipId+'-title'} onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===dialog.current)close();}}><button type="button" className="btn secondary" onClick={close}>Închide versurile</button>{content}</dialog>:<div ref={popup} id={tooltipId} className="song-lyrics-tooltip" role="tooltip" onMouseEnter={()=>clearTimeout(hide.current)} onMouseLeave={later} style={{left:pos.left,top:pos.top,maxHeight:`${Math.max(120,window.innerHeight-pos.top-12)}px`}}>{content}</div>,document.body):null}
 </span>;
}
