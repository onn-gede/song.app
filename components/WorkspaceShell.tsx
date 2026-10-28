"use client";
import { useEffect,useRef,useState,type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "./Icon";
const labels:Record<string,string>={dashboard:"Acasă",songs:"Cântări",meetings:"Programe",collections:"Colecții",categories:"Categorii",import:"Import",review:"De verificat",duplicates:"Duplicate",admin:"Administrare",users:"Utilizatori",activity:"Activitate",edit:"Editare",lyrics:"Versuri",verses:"Versete",present:"Prezentare","youth-keys":"Game Tineri"};
export function WorkspaceShell({sidebar,children}:{sidebar:ReactNode;children:ReactNode}) {
 const [open,setOpen]=useState(false);const [mobile,setMobile]=useState(false);const path=usePathname();const drawer=useRef<HTMLElement>(null);const toggle=useRef<HTMLButtonElement>(null);
 const parts=path.split("/").filter(Boolean);const isPresentation=parts.at(-1)==="present";
 useEffect(()=>{setOpen(false);},[path]);
 useEffect(()=>{const query=window.matchMedia("(max-width:900px), (max-height:600px)");const sync=()=>{setMobile(query.matches);if(!query.matches)setOpen(false);};sync();query.addEventListener("change",sync);return()=>query.removeEventListener("change",sync);},[]);
 useEffect(()=>{
  if(!open)return;const previous=document.activeElement as HTMLElement | null;const oldOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
  const controls=()=>Array.from(drawer.current?.querySelectorAll<HTMLElement>('a,button,[tabindex="0"]')||[]).filter(el=>el.getClientRects().length);
  controls()[0]?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);return;}if(e.key!=="Tab")return;const all=controls();const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};
  document.addEventListener("keydown",key);return()=>{document.body.style.overflow=oldOverflow;document.removeEventListener("keydown",key);previous?.focus();};
 },[open]);
 return <div className={`workspace-v44${isPresentation?" workspace-presenting":""}`}>
  <a className="skip-link" href="#main-content">Sari la conținut</a>
  {open?<button className="workspace-mobile-backdrop" aria-label="Închide meniul" onClick={()=>setOpen(false)}/>:null}
  <aside id="workspace-sidebar" ref={drawer} className={`workspace-sidebar${open?" is-open":""}`} inert={mobile&&!open} aria-hidden={mobile&&!open?true:undefined} role={open?"dialog":undefined} aria-modal={open?true:undefined} aria-label="Navigare" onClick={e=>{if((e.target as HTMLElement).closest('a'))setOpen(false);}}>
   <button className="workspace-mobile-close" aria-label="Închide meniul" onClick={()=>setOpen(false)}><Icon name="close"/></button>{sidebar}
  </aside>
  <div className="workspace-body"><header className="workspace-topbar"><div className="workspace-breadcrumb"><button ref={toggle} className="workspace-menu-toggle" aria-label="Deschide meniul" aria-expanded={open} aria-controls="workspace-sidebar" onClick={()=>setOpen(!open)}><Icon name="menu"/></button><span>Biblioteca echipei</span><Icon name="chevron" size={14}/><strong>{labels[parts[0]]||"SongApp"}</strong>{parts.length>1?<><Icon name="chevron" size={14}/><span>{labels[parts.at(-1)!]||"Detalii"}</span></>:null}</div><Link href="/songs" className="workspace-top-search"><Icon name="search" size={18}/><span>Caută o cântare</span></Link></header>
   <main id="main-content" className="main-v44">{children}</main>
  </div>
 </div>;
}
