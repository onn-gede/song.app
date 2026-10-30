"use client";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {changedProgramIds} from '@/lib/song-performance';
const Context=createContext<Set<string>>(new Set());
export function ProgramChangeTracker({items,children}:{items:Array<{id?:string}>;children:ReactNode}){
 const previous=useRef<Record<string,string>|null>(null),timers=useRef(new Map<string,ReturnType<typeof setTimeout>>());const [changed,setChanged]=useState(new Set<string>());
 const signature=JSON.stringify(items.map(item=>[item.id,JSON.stringify(item)]));
 useEffect(()=>{const next=Object.fromEntries(JSON.parse(signature) as [string,string][]);const ids=changedProgramIds(previous.current,next);previous.current=next;if(ids.length){setChanged(old=>new Set([...old,...ids]));for(const id of ids){clearTimeout(timers.current.get(id));timers.current.set(id,setTimeout(()=>{setChanged(old=>{const n=new Set(old);n.delete(id);return n;});timers.current.delete(id);},5000));}}},[signature]);
 useEffect(()=>()=>{for(const timer of timers.current.values())clearTimeout(timer);},[]);
 return <Context.Provider value={changed}>{children}</Context.Provider>;
}
export function useProgramChange(id:string){return useContext(Context).has(id);}
export function ChangedProgramItem({id,children}:{id:string;children:ReactNode}){const changed=useProgramChange(id);return <div className={changed?'program-change-frame recent-program-change':'program-change-frame'}>{children}</div>;}
