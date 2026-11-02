"use client";
import {useState} from "react";
import {SaveForm} from "./SaveForm";
import {editSongSourceAction} from "@/app/(app)/songs/actions";

type Collection={id:string;name:string};
export function SongSourceEditor({songId,source,collections,suggestions}:{songId:string;source:{id:string;collection_id:string;song_number:string|null};collections:Collection[];suggestions:Record<string,string>}){
 const [collection,setCollection]=useState(source.collection_id),[number,setNumber]=useState(source.song_number||"");
 const suggestion=suggestions[collection]||"";
 return <SaveForm className="song-source-edit-row" action={editSongSourceAction}>
  <input type="hidden" name="song_id" value={songId}/><input type="hidden" name="source_id" value={source.id}/>
  <label className="label">Colecție<select className="select" name="collection_id" value={collection} onChange={event=>{const value=event.target.value;setCollection(value);setNumber(value===source.collection_id?source.song_number||"":suggestions[value]||"");}}>{collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  <label className="label">Număr<input className="input" name="song_number" value={number} onChange={event=>setNumber(event.target.value)} maxLength={60}/>{suggestion?<small>Următorul număr disponibil: <strong>{suggestion}</strong></small>:null}</label>
  <button className="btn secondary">Salvează colecția și numărul</button>
 </SaveForm>;
}
