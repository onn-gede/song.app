"use client";
import Link from "next/link";
import { collectionStyle } from "@/lib/collection-colors";
import { useMemo,useState } from "react";
import { useSearchParams } from "next/navigation";
import { bulkDeleteSongsAction } from "@/app/(app)/songs/actions";
import { AddSongToMeeting } from "./AddSongToMeeting";
import { Icon } from "./Icon";
type SongRow={times_sung?:number;last_used_at?:string|null;id:string;title:string;default_key?:string|null;bpm?:number|null;structure?:string|null;song_sources?:Array<{source_id?:string;song_number?:string|null;source_title?:string|null;song_collections?:{id?:string;name?:string;short_code?:string|null}|null}>;song_categories?:Array<{categories?:{name?:string}|null}>;song_files?:Array<{import_status?:string|null}>};
export function SongsBulkList({songs,canManage=false,collections=[]}:{songs:SongRow[];canManage?:boolean;collections?:Array<{id:string;color?:string|null;is_active?:boolean}>}) {
 const params=useSearchParams();const [selecting,setSelecting]=useState(false),[ids,setIds]=useState<string[]>([]),[confirm,setConfirm]=useState("");
 const selected=useMemo(()=>new Set(ids),[ids]);const all=songs.length>0&&ids.length===songs.length;
 return <div className="song-list-v44">
  <div className="song-list-controls"><div className="song-list-legend"><Icon name="list" size={16}/><span>Titlu și colecție</span></div>{canManage?<button type="button" className={`quiet-button${selecting?" is-active":""}`} onClick={()=>{setSelecting(!selecting);setIds([]);setConfirm("");}}>{selecting?"Renunță la selecție":"Selectează cântări"}</button>:null}</div>
  {selecting?<form className="selection-toolbar-v44" action={bulkDeleteSongsAction}><input type="hidden" name="current_query" value={params.toString()}/>{ids.map(id=><input key={id} type="hidden" name="song_ids" value={id}/>)}<label><input type="checkbox" checked={all} onChange={()=>setIds(all?[]:songs.map(s=>s.id))}/>Selectează pagina</label><span>{ids.length} selectate</span>{ids.length?<><label className="sr-only" htmlFor="bulk-confirm">Confirmă ștergerea scriind STERGE</label><input id="bulk-confirm" className="input" name="confirm" placeholder="Scrie STERGE" value={confirm} onChange={e=>setConfirm(e.target.value)}/><button type="submit" className="btn danger" disabled={confirm!=="STERGE"}>Șterge selectate</button></>:null}</form>:null}
  <div className="song-column-head" aria-hidden="true"><span/><span>Cântare</span><span>Tonalitate</span><span>Tempo</span><span/></div>
  <div className="song-rows-v44">{songs.map(song=>{
   const primary=(song.song_sources||[]).find(s=>s.song_collections?.id===params.get("collection"))||song.song_sources?.[0];
   const sourceColor=collections.find(c=>c.id===primary?.song_collections?.id);
   const sources=(song.song_sources||[]).map(s=>`${s.song_collections?.short_code||s.song_collections?.name||"Colecție"}${s.song_number?` · ${s.song_number}`:""}`);
   const cats=(song.song_categories||[]).map(c=>c.categories?.name).filter(Boolean);
   const review=(song.song_files||[]).some(f=>f.import_status==="needs_review");
   return <article key={song.id} className={`song-library-row collection-colored${selected.has(song.id)?" is-selected":""}`} style={collectionStyle(sourceColor)}>
    {selecting?<label className="song-select-v44" aria-label={`Selectează ${song.title}`}><input type="checkbox" checked={selected.has(song.id)} onChange={()=>setIds(current=>current.includes(song.id)?current.filter(id=>id!==song.id):[...current,song.id])}/></label>:<span className="song-library-mark"><Icon name="music" size={20}/></span>}
    <Link prefetch={false} className="song-library-content" href={`/songs/${song.id}`}><span className="song-library-title">{song.title}</span><span className="song-library-meta">{sources.length?<span>{sources.slice(0,2).join("  /  ")}{sources.length>2?` +${sources.length-2}`:""}</span>:<span>Fără colecție</span>}{cats.length?<><span className="meta-separator">·</span><span>{cats.slice(0,2).join(", ")}</span></>:null}{review?<span className="review-indicator"><i/>De verificat</span>:null}</span><span className="song-library-usage">{song.last_used_at ? <>Ultima: <time dateTime={song.last_used_at}>{new Date(song.last_used_at).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Bucharest" })}</time> · {song.times_sung} {song.times_sung === 1 ? "program" : "programe"}</> : "Fără utilizări în programe trecute"}</span></Link>
    <div className="song-library-key">{song.default_key?<span>{song.default_key}</span>:<small>—</small>}</div><div className="song-library-tempo">{song.bpm?<>{song.bpm}<small>BPM</small></>:<small>—</small>}</div>
    <div className="song-library-actions"><Link prefetch={false} href={`/songs/${song.id}/present`} className="song-present-button" title="Prezintă cântarea" aria-label={`Prezintă ${song.title}`}><Icon name="play" size={16}/></Link>{canManage?<AddSongToMeeting songId={song.id} songTitle={song.title} compact sourceOptions={(song.song_sources||[]).filter(s=>s.source_id&&collections.find(c=>c.id===s.song_collections?.id)?.is_active!==false).map(s=>({id:s.source_id!,name:s.song_collections?.name||"Colecție",number:s.song_number||null,color:collections.find(c=>c.id===s.song_collections?.id)?.color}))}/>:null}</div>
   </article>;
  })}</div>
  {!songs.length?<div className="empty-state-v44"><span><Icon name="search" size={30}/></span><h2>Nicio cântare găsită</h2><p>Încearcă un alt cuvânt sau elimină unul dintre filtre.</p><Link prefetch={false} className="btn secondary" href="/songs?page=1">Vezi toate cântările</Link></div>:null}
 </div>;
}
