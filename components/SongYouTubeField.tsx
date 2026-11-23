"use client";
import {useState} from "react";
import {YouTubeSuggestion} from "./YouTubeSuggestion";
export function SongYouTubeField({songId,title,initialUrl,isYouth}:{songId:string;title:string;initialUrl:string;isYouth:boolean}){const [url,setUrl]=useState(initialUrl);return <><label className="label">Link YouTube <span className="muted small">(opțional)</span><input className="input" name="youtube_url" type="url" inputMode="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..."/><small>Acceptă linkuri youtube.com, youtu.be, Shorts, Live sau Embed.</small></label>{isYouth?<YouTubeSuggestion query={title} songId={songId} onSelect={setUrl}/>:null}</>}
