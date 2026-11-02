"use client";

import {useEffect,useRef,useState} from "react";
import {Icon} from "./Icon";

type ScreenChoice={id:string;label:string;left:number;top:number;width:number;height:number;primary:boolean;current:boolean};
type DetailedScreen={label?:string;left:number;top:number;width:number;height:number;isPrimary?:boolean};
type ScreenDetails={screens:DetailedScreen[];currentScreen?:DetailedScreen};

export function PresentationLaunchButton({href,label="Prezintă",className="btn secondary",icon=true}:{href:string;label?:string;className?:string;icon?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false),[loading,setLoading]=useState(false),[screens,setScreens]=useState<ScreenChoice[]>([]),[supported,setSupported]=useState(true),[error,setError]=useState("");
 useEffect(()=>{if(!open)return;dialog.current?.showModal();return()=>{dialog.current?.close();trigger.current?.focus({preventScroll:true});};},[open]);
 async function inspect(){setOpen(true);setLoading(true);setError("");setScreens([]);try{
  const extended=window as Window&{getScreenDetails?:()=>Promise<ScreenDetails>};
  if(!extended.getScreenDetails){setSupported(false);return;}
  const details=await extended.getScreenDetails();setSupported(true);
  setScreens(details.screens.map((screen,index)=>({id:String(index),label:screen.label||`Ecran ${index+1}`,left:screen.left,top:screen.top,width:screen.width,height:screen.height,primary:!!screen.isPrimary,current:screen===details.currentScreen})));
 }catch{setSupported(false);setError("Browserul nu a permis identificarea ecranelor. Poți deschide prezentarea într-o fereastră separată și o poți muta manual.");}finally{setLoading(false);}}
 function launch(screen?:ScreenChoice){
  const features=screen?`popup=yes,left=${Math.round(screen.left)},top=${Math.round(screen.top)},width=${Math.max(640,Math.round(screen.width))},height=${Math.max(480,Math.round(screen.height))}`:"popup=yes,width=1280,height=800";
  const popup=window.open(href,`songapp-presentation-${href.replace(/[^a-z0-9]/gi,"-")}`,features);
  if(!popup){setError("Browserul a blocat fereastra. Permite ferestre pop-up pentru SongApp și încearcă din nou.");return;}
  try{popup.moveTo(screen?.left??100,screen?.top??100);if(screen)popup.resizeTo(screen.width,screen.height);popup.focus();}catch{}
  setOpen(false);
 }
 return <><button ref={trigger} type="button" className={className} onClick={()=>void inspect()}>{icon?<Icon name="play" size={16}/>:null}{label}</button>{open?<dialog ref={dialog} className="dialog modal-card projection-dialog" aria-labelledby="projection-title" onCancel={event=>{event.preventDefault();setOpen(false);}} onClick={event=>{if(event.target===dialog.current)setOpen(false);}}><div className="modal-header"><div><div className="eyebrow">Proiecție</div><h2 id="projection-title">Alege ecranul prezentării</h2></div><button className="icon-btn" type="button" aria-label="Închide" onClick={()=>setOpen(false)}>×</button></div>
 {loading?<p role="status">Verific ecranele conectate…</p>:screens.length?<div className="projection-screen-list">{screens.map(screen=><button type="button" className="projection-screen" key={screen.id} onClick={()=>launch(screen)}><span className="projection-screen-icon" aria-hidden="true">▭</span><span><strong>{screen.label}</strong><small>{screen.current?"Ecranul curent":screen.primary?"Ecran principal":"Ecran disponibil"} · {screen.width}×{screen.height}</small></span></button>)}</div>:<div className="projection-fallback"><p>{supported?"Nu a fost detectat un al doilea ecran.":"Selectarea automată a ecranului nu este disponibilă în acest browser."}</p><p className="muted small">Deschide fereastra separată, apoi mut-o pe proiector cu <strong>Windows + Shift + săgeată</strong>. În prezentare poți activa ecranul complet.</p></div>}
 {error?<p className="error" role="alert">{error}</p>:null}<div className="inline-form modal-actions"><button className="btn" type="button" onClick={()=>launch()}>Deschide fereastră separată</button><a className="btn secondary" href={href}>Deschide în acest tab</a></div></dialog>:null}</>;
}
