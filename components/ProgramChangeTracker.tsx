"use client";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {changedProgramIds} from '@/lib/song-performance';
const Context=createContext<Set<string>>(new Set());
export function ProgramChangeTracker({items,children,persistent=false,storageKey}:{items:Array<{id?:string}>;children:ReactNode;persistent?:boolean;storageKey?:string}){
 const previous=useRef<Record<string,string>|null>(null);const latest=useRef<Record<string,string>>({});const [changed,setChanged]=useState(new Set<string>());
 const signature=JSON.stringify(items.map(item=>[item.id,JSON.stringify(item)]));
 useEffect(()=>{
  const next=Object.fromEntries(JSON.parse(signature) as [string,string][]);latest.current=next;
  if(persistent&&storageKey){
   const key=`songapp:live-seen:${storageKey}`;
   let baseline:Record<string,string>|null=null;
   try{const raw=sessionStorage.getItem(key);baseline=raw?JSON.parse(raw):null;}catch{}
   if(!baseline){try{sessionStorage.setItem(key,JSON.stringify(next));}catch{}setChanged(new Set());return;}
   const ids=changedProgramIds(baseline,next);setChanged(new Set(ids));if(ids.length)queueMicrotask(()=>window.dispatchEvent(new CustomEvent('songapp:live-changes-detected',{detail:{count:ids.length}})));return;
  }
  const ids=changedProgramIds(previous.current,next);previous.current=next;if(ids.length)setChanged(old=>new Set([...old,...ids]));
 },[signature,persistent,storageKey]);
 useEffect(()=>{if(!persistent)return;const clear=()=>{if(storageKey)try{sessionStorage.setItem(`songapp:live-seen:${storageKey}`,JSON.stringify(latest.current));}catch{}setChanged(new Set());};window.addEventListener('songapp:acknowledge-live-changes',clear);return()=>window.removeEventListener('songapp:acknowledge-live-changes',clear);},[persistent,storageKey]);
 return <Context.Provider value={changed}>{children}</Context.Provider>;
}
export function useProgramChange(id:string){return useContext(Context).has(id);}
export function ChangedProgramItem({id,children}:{id:string;children:ReactNode}){const changed=useProgramChange(id);return <div className={changed?'program-change-frame recent-program-change':'program-change-frame'}>{children}</div>;}
