"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { mergeDuplicateGroupsAction } from "@/app/(app)/duplicates/actions";
export type DuplicateGroup={group_key:string;title_hint:string;song_count:number;songs:Array<{id:string;title:string;default_key?:string|null;collections?:string|null;numbers?:string|null;lyrics_length?:number|null}>};
export function DuplicateMergeList({groups}:{groups:DuplicateGroup[]}){
 const [selected,setSelected]=useState<string[]>([]),[plans,setPlans]=useState(()=>Object.fromEntries(groups.map(g=>[g.group_key,{primary:g.songs[0]?.id||'',duplicates:g.songs.slice(1).map(s=>s.id)}])));
 const [confirm,setConfirm]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[pending,start]=useTransition();
 const [done,setDone]=useState<string[]>([]);const available=groups.filter(g=>!done.includes(g.group_key));
 const all=available.length>0&&available.every(g=>selected.includes(g.group_key));
 const toggle=(key:string)=>setSelected(current=>current.includes(key)?current.filter(k=>k!==key):[...current,key]);
 return <div className="duplicate-bulk-list"><div className="card duplicate-bulk-toolbar">
  <label><input type="checkbox" checked={all} disabled={pending} onChange={()=>setSelected(all?[]:available.map(g=>g.group_key))}/> Selectează toate grupurile afișate ({available.length})</label>
  <span>{selected.length} grupuri selectate</span><input className="input" aria-label="Confirmă unificarea" placeholder="Scrie UNIFICA" value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={pending}/>
  <button className="btn" disabled={pending||!selected.length||confirm!=='UNIFICA'} onClick={()=>start(async()=>{
    setError('');setMessage('');const keys=[...selected];
    try{const result=await mergeDuplicateGroupsAction(keys.map(key=>plans[key]),confirm);setDone(current=>[...current,...keys]);setSelected([]);setConfirm('');setMessage(`${result.merged} duplicate unificate în ${result.groups} grupuri.`);}
    catch(err){setError(err instanceof Error?err.message:'Unificarea a eșuat.');}
  })}>{pending?'Se unifică…':'Unifică grupurile selectate'}</button>
 </div><p className="muted small">Verifică selecția: rămân versurile variantei principale. Sursele, programele și asocierile sunt păstrate; versiunile eliminate sunt arhivate.</p>
 {error?<p className="error" role="alert">{error}</p>:null}{message?<p className="success" role="status">{message}</p>:null}
 {available.map(group=><section className="card duplicate-group-card" key={group.group_key}>
  <div className="top-row"><label><input type="checkbox" checked={selected.includes(group.group_key)} disabled={pending} onChange={()=>toggle(group.group_key)}/> <strong>{group.title_hint}</strong></label><span>{group.song_count} variante</span></div>
  <div className="duplicate-table"><div className="duplicate-row duplicate-row-head"><span>Principală</span><span>Unifică</span><span>Cântare</span><span>Surse</span><span>Text</span></div>
  {group.songs.map(song=><div className="duplicate-row" key={song.id}>
   <label><input type="radio" name={`primary-${group.group_key}`} aria-label={`Păstrează ${song.title} ${song.id}`} checked={plans[group.group_key].primary===song.id} disabled={pending} onChange={()=>setPlans(current=>{const old=current[group.group_key];return {...current,[group.group_key]:{primary:song.id,duplicates:[...new Set([...old.duplicates,old.primary])].filter(id=>id!==song.id)}};})}/><span className="sr-only">Rămâne principală</span></label>
   <label><input type="checkbox" aria-label={`Unifică ${song.title} ${song.id}`} checked={plans[group.group_key].duplicates.includes(song.id)} disabled={pending||plans[group.group_key].primary===song.id} onChange={()=>setPlans(current=>{const old=current[group.group_key];return {...current,[group.group_key]:{...old,duplicates:old.duplicates.includes(song.id)?old.duplicates.filter(id=>id!==song.id):[...old.duplicates,song.id]}};})}/><span className="sr-only">Duplicat</span></label>
   <Link prefetch={false} href={`/songs/${song.id}`} target="_blank">{song.title}{song.default_key?` · ${song.default_key}`:''}</Link><span className="muted small">{song.collections||'—'}{song.numbers?` · ${song.numbers}`:''}</span><span>{song.lyrics_length||0} caractere</span>
  </div>)}</div>
 </section>)}
 {!available.length?<p className="card">Nu mai sunt grupuri în această listă.</p>:null}
 </div>;
}
