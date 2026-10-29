"use client";
import {useEffect,useRef,useState} from 'react';
import {Icon} from "./Icon";
import {useRouter} from 'next/navigation';
export function PublicProgramLive({slug,version}:{slug:string;version:string}){
 const router=useRouter(),latest=useRef(version),title=useRef(''),registration=useRef<ServiceWorkerRegistration|null>(null),notice=useRef<Notification|null>(null);
 const [message,setMessage]=useState(''),[permission,setPermission]=useState<string>('unsupported'),[sound,setSound]=useState(false);
 const audio=useRef<AudioContext|null>(null),soundEnabled=useRef(false);
 useEffect(()=>{title.current=document.title;return()=>{document.title=title.current;notice.current?.close();void audio.current?.close();};},[]);
 useEffect(()=>{
  if(!message)return;
  const attentionTitle='🔴 Program modificat — '+title.current;
  const sync=()=>{if(document.title!==attentionTitle)document.title=attentionTitle;};
  // Next updates metadata during the automatic refresh. Keep attention until acknowledged.
  const observer=new MutationObserver(sync);observer.observe(document.head,{childList:true,subtree:true,characterData:true});sync();
  return()=>{observer.disconnect();document.title=title.current;};
 },[message]);
 useEffect(()=>{
  if(!('Notification' in window))return;
  const sync=()=>setPermission(Notification.permission);sync();window.addEventListener('focus',sync);
  return()=>window.removeEventListener('focus',sync);
 },[]);
 useEffect(()=>{if(permission==='granted'&&'serviceWorker' in navigator){navigator.serviceWorker.register('/notifications-sw.js').then(r=>{registration.current=r;}).catch(()=>{});}},[permission]);
 async function systemNotice(){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const options:NotificationOptions={body:'Programul a fost modificat. Deschide pagina pentru a vedea noutățile.',tag:`songapp-${slug}`,requireInteraction:true,data:{url:`/program/${encodeURIComponent(slug)}`}};
  try{if(registration.current?.active){await registration.current.showNotification('🔔 Program modificat · SongApp',options);return;}}catch{}
  try{notice.current?.close();const n=new Notification('🔔 Program modificat · SongApp',options);notice.current=n;n.onclick=()=>{window.focus();n.close();};}catch{}
 }
 function beep(){if(!soundEnabled.current||!audio.current)return;try{const a=audio.current;void a.resume();for(const delay of [0,.25]){const oscillator=a.createOscillator(),gain=a.createGain(),at=a.currentTime+delay;oscillator.frequency.value=880;gain.gain.setValueAtTime(.001,at);gain.gain.exponentialRampToValueAtTime(.12,at+.015);gain.gain.exponentialRampToValueAtTime(.001,at+.18);oscillator.connect(gain);gain.connect(a.destination);oscillator.start(at);oscillator.stop(at+.2);}}catch{}}
 useEffect(()=>{
  let stopped=false,busy=false;const controller=new AbortController();
  async function check(){
   if(stopped||busy)return;busy=true;
   try{
    const response=await fetch(`/api/public-program/${encodeURIComponent(slug)}`,{cache:'no-store',signal:controller.signal});
    if(stopped)return;if(response.status===404){stopped=true;router.refresh();return;}if(!response.ok)return;
    const data=await response.json();if(stopped||typeof data.version!=='string'||data.version===latest.current)return;
    latest.current=data.version;
    setMessage('Programul a fost modificat. Verifică ordinea și detaliile actualizate.');
    document.title='🔴 Program modificat — '+title.current;
    void systemNotice();beep();router.refresh();
   }catch{/* Retry after connection recovery or on the next check. */}finally{busy=false;}
  }
  // Keep checking with a minimized window too; the browser may throttle its timers.
  const timer=window.setInterval(check,15000);
  document.addEventListener('visibilitychange',check);window.addEventListener('focus',check);window.addEventListener('online',check);
  return()=>{stopped=true;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',check);window.removeEventListener('focus',check);window.removeEventListener('online',check);};
 },[slug,router]); // systemNotice/beep read current permission and refs, never request permission automatically.
 function acknowledge(){setMessage('');notice.current?.close();void registration.current?.getNotifications({tag:`songapp-${slug}`}).then(all=>all.forEach(n=>n.close()));}
 return <div className="public-live print-hide"><span className="live-indicator" title="Actualizare automată când programul se schimbă">● Live</span>
 {permission==='default'?<button type="button" className="btn secondary" onClick={async()=>{try{setPermission(await Notification.requestPermission());}catch{}}}><Icon name="bell" size={15}/> Activează notificările</button>:permission==='granted'?<span className="notification-enabled"><Icon name="bell" size={14}/> Notificări active</span>:permission==='denied'?<span className="muted small" title="Permite notificările din setările acestui site în browser">Notificări blocate în browser</span>:null}
 <button type="button" className="quiet-button" aria-pressed={sound} onClick={()=>{const enabled=!sound;setSound(enabled);soundEnabled.current=enabled;if(enabled){try{audio.current??=new AudioContext();void audio.current.resume();beep();}catch{}}}}>Sunet {sound?'activ':'oprit'}</button>
 {message?<aside className="public-live-notice public-attention-notice" role="alert" aria-live="assertive"><span aria-hidden="true"><Icon name="bell" size={26}/></span><div><strong>Program actualizat</strong><p>{message}</p></div><button type="button" className="btn" onClick={acknowledge}>Am văzut</button></aside>:null}</div>;
}
