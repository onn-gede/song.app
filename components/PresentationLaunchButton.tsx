"use client";

import {useEffect,useRef,useState} from "react";
import {Icon} from "./Icon";

type ScreenChoice={id:string;label:string;left:number;top:number;width:number;height:number;primary:boolean;current:boolean};
type DetailedScreen={label?:string;left:number;top:number;width:number;height:number;isPrimary?:boolean};
type ScreenDetails={screens:DetailedScreen[];currentScreen?:DetailedScreen};
type ProjectionState={channel:string;index:number;total:number;flash:boolean};
const LAST_SCREEN_KEY="songapp:last-projection-screen-v89";

export function PresentationLaunchButton({href,label="Prezintă",className="btn secondary",icon=true}:{href:string;label?:string;className?:string;icon?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const popupRef=useRef<Window|null>(null),channelRef=useRef<BroadcastChannel|null>(null);
 const [open,setOpen]=useState(false),[loading,setLoading]=useState(false),[screens,setScreens]=useState<ScreenChoice[]>([]),[supported,setSupported]=useState(true),[error,setError]=useState("");
 const [projection,setProjection]=useState<ProjectionState|null>(null);
 useEffect(()=>{if(!open)return;dialog.current?.showModal();return()=>{dialog.current?.close();trigger.current?.focus({preventScroll:true});};},[open]);
 async function inspect(){setOpen(true);setLoading(true);setError("");setScreens([]);try{
  const extended=window as Window&{getScreenDetails?:()=>Promise<ScreenDetails>};
  if(!extended.getScreenDetails){setSupported(false);return;}
  const details=await extended.getScreenDetails();setSupported(true);
  setScreens(details.screens.map((screen,index)=>({id:String(index),label:screen.label||`Ecran ${index+1}`,left:screen.left,top:screen.top,width:screen.width,height:screen.height,primary:!!screen.isPrimary,current:screen===details.currentScreen})));
 }catch{setSupported(false);setError("Browserul nu a permis identificarea ecranelor. Poți deschide prezentarea într-o fereastră separată și o poți muta manual.");}finally{setLoading(false);}}
 useEffect(()=>()=>{channelRef.current?.close();try{popupRef.current?.close();}catch{}},[]);
 useEffect(()=>{if(!projection)return;const timer=window.setInterval(()=>{if(popupRef.current?.closed){channelRef.current?.close();channelRef.current=null;popupRef.current=null;setProjection(null);}},700);return()=>window.clearInterval(timer);},[projection]);
 function send(type:string){
  if(!projection)return;
  const message={source:"songapp-projection",channel:projection.channel,type};
  channelRef.current?.postMessage(message);
  try{popupRef.current?.postMessage(message,window.location.origin);}catch{}
 }
 function closeProjection(){send("close");try{popupRef.current?.close();}catch{}channelRef.current?.close();channelRef.current=null;popupRef.current=null;setProjection(null);}
 function launch(screen?:ScreenChoice){
  const channel=crypto.randomUUID();
  const destination=new URL(href,window.location.href);destination.searchParams.set("projection","1");destination.searchParams.set("channel",channel);
  const features=screen?`popup=yes,left=${Math.round(screen.left)},top=${Math.round(screen.top)},width=${Math.max(640,Math.round(screen.width))},height=${Math.max(480,Math.round(screen.height))}`:"popup=yes,width=1280,height=800";
  const popup=window.open(destination.toString(),`songapp-presentation-${href.replace(/[^a-z0-9]/gi,"-")}`,features);
  if(!popup){setError("Browserul a blocat fereastra. Permite ferestre pop-up pentru SongApp și încearcă din nou.");return;}
  channelRef.current?.close();
  const broadcast=typeof BroadcastChannel!=="undefined"?new BroadcastChannel(`songapp-projection-${channel}`):null;
  if(broadcast)broadcast.onmessage=event=>{const value=event.data;if(value?.type==="state")setProjection(current=>current?.channel===channel?{...current,index:Number(value.index)||0,total:Number(value.total)||0,flash:!!value.flash}:current);if(value?.type==="closed"){popupRef.current=null;setProjection(null);}};
  channelRef.current=broadcast;popupRef.current=popup;setProjection({channel,index:0,total:0,flash:false});
  if(screen)try{localStorage.setItem(LAST_SCREEN_KEY,JSON.stringify(screen));}catch{}
  try{popup.moveTo(screen?.left??100,screen?.top??100);if(screen)popup.resizeTo(screen.width,screen.height);popup.focus();}catch{}
  setOpen(false);
 }
 useEffect(()=>{
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key!=="F5")return;
   event.preventDefault();
   if(event.shiftKey){window.location.assign(href);return;}
   if(projection){send("first");try{popupRef.current?.focus();}catch{}return;}
   try{const saved=JSON.parse(localStorage.getItem(LAST_SCREEN_KEY)||"null") as ScreenChoice|null;if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top)&&Number.isFinite(saved.width)&&Number.isFinite(saved.height)){launch(saved);return;}}catch{}
   void inspect();
  };
  window.addEventListener("keydown",onKeyDown);return()=>window.removeEventListener("keydown",onKeyDown);
 },[href,projection]);
 return <><button ref={trigger} type="button" className={className} onClick={()=>void inspect()}>{icon?<Icon name="play" size={16}/>:null}{label}</button>{projection?<aside className="projection-controller" aria-label="Control proiecție"><div><span className="live-indicator">● Proiecție activă</span><strong>{projection.total?`${projection.index+1} / ${projection.total}`:"Se conectează…"}</strong></div><div className="projection-controller-actions">{projection.flash?<button type="button" className="projection-ack" onClick={()=>send("ack")}>Am văzut</button>:null}<button type="button" onClick={()=>send("first")} title="Primul slide">|←</button><button type="button" onClick={()=>send("previous")}>← Înapoi</button><button type="button" onClick={()=>send("next")}>Înainte →</button><button type="button" onClick={()=>send("last")} title="Ultimul slide">→|</button><button type="button" onClick={()=>send("smaller")} title="Micșorează textul">A−</button><button type="button" onClick={()=>send("larger")} title="Mărește textul">A+</button><button type="button" className="projection-close" onClick={closeProjection}>Închide proiecția</button></div></aside>:null}{open?<dialog ref={dialog} className="dialog modal-card projection-dialog" aria-labelledby="projection-title" onCancel={event=>{event.preventDefault();setOpen(false);}} onClick={event=>{if(event.target===dialog.current)setOpen(false);}}><div className="modal-header"><div><div className="eyebrow">Proiecție</div><h2 id="projection-title">Alege ecranul prezentării</h2></div><button className="icon-btn" type="button" aria-label="Închide" onClick={()=>setOpen(false)}>×</button></div>
 {loading?<p role="status">Verific ecranele conectate…</p>:screens.length?<div className="projection-screen-list">{screens.map(screen=><button type="button" className="projection-screen" key={screen.id} onClick={()=>launch(screen)}><span className="projection-screen-icon" aria-hidden="true">▭</span><span><strong>{screen.label}</strong><small>{screen.current?"Ecranul curent":screen.primary?"Ecran principal":"Ecran disponibil"} · {screen.width}×{screen.height}</small></span></button>)}</div>:<div className="projection-fallback"><p>{supported?"Nu a fost detectat un al doilea ecran.":"Selectarea automată a ecranului nu este disponibilă în acest browser."}</p><p className="muted small">Deschide fereastra separată, apoi mut-o pe proiector cu <strong>Windows + Shift + săgeată</strong>. În prezentare poți activa ecranul complet.</p></div>}
 {error?<p className="error" role="alert">{error}</p>:null}<div className="inline-form modal-actions"><button className="btn" type="button" onClick={()=>launch()}>Deschide proiecția separată <kbd>F5</kbd></button><a className="btn secondary" href={href}>Deschide în acest tab <kbd>Shift+F5</kbd></a></div></dialog>:null}</>;
}
