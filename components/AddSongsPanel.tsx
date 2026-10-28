"use client";

import Link from "next/link";
import { useMeetingState } from "./MeetingState";
import { useEffect, useRef, useState, useTransition } from "react";
import { addSongToMeetingAction, type RecentUsage, type SongSearchResult } from "@/app/(app)/meetings/actions";
import { RecentUsageIcon } from "@/components/RecentUsageIcon";

export function AddSongsPanel({ meetingId, recentUsage = {}, initiallyOpen = false }: { meetingId: string; recentUsage?: Record<string, RecentUsage>; initiallyOpen?:boolean }) {
  const state = useMeetingState();
  const [open,setOpen]=useState(initiallyOpen);
  const inputRef=useRef<HTMLInputElement>(null);
  const adding=useRef(false);
  useEffect(()=>{if(open)inputRef.current?.focus({preventScroll:true});},[open]);
  const cache=useRef(new Map<string,SongSearchResult[]>());
  const [searching,setSearching]=useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const trimmed=query.trim();const controller=new AbortController();let active=true;
    if(trimmed.length<2&&!/^\d$/.test(trimmed)){setResults([]);setSearching(false);setError(null);return;}
    const cached=cache.current.get(trimmed.toLocaleLowerCase());
    if(cached){setResults(cached);setSearching(false);setError(null);return;}
    setSearching(true);setResults([]);setError(null);
    const handle=window.setTimeout(async()=>{
      try{
        const response=await fetch(`/api/songs/search?q=${encodeURIComponent(trimmed)}`,{signal:controller.signal,cache:'no-store'});
        const data=await response.json();if(!response.ok)throw new Error(data.error||'Căutarea a eșuat.');
        if(active){if(cache.current.size>40)cache.current.clear();cache.current.set(trimmed.toLocaleLowerCase(),data);setResults(data);}
      }catch(error){if(active&&!controller.signal.aborted)setError(error instanceof Error?error.message:'Căutarea a eșuat.');}
      finally{if(active)setSearching(false);}
    },180);
    return()=>{active=false;controller.abort();window.clearTimeout(handle);};
  },[query]);

  function add(song: SongSearchResult, isBackup: boolean) {
    if(adding.current)return;adding.current=true;
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const saved = await addSongToMeetingAction({
          meetingId,
          songId: song.song_id,
          isBackup,
          selectedKey: song.default_key,
          notes: null
        });
        state?.apply(saved);
        setQuery("");setResults([]);setSearching(false);
        inputRef.current?.focus({preventScroll:true});
        setMessage(isBackup ? "Cântarea a fost adăugată ca backup." : "Cântarea a fost adăugată în program.");
      } catch (error) {
        setError(error instanceof Error ? error.message : "Nu am putut adăuga cântarea.");
      } finally {adding.current=false;}
    });
  }

  return (
    <details className="program-add-tray print-hide" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
      <summary>+ Adaugă cântări</summary>
    <section className="card grid">
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <input ref={inputRef} aria-label="Caută cântări pentru program" autoComplete="off" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută după titlu, versuri sau număr (ex: 352)" />
      <p className="song-search-status" role="status" aria-live="polite">{searching?"Se caută…":results.length?`${results.length} rezultate`:query.trim().length>=2?"Nicio cântare găsită.":"Caută după titlu, versuri sau număr."}</p>
      <div className="list compact-list" aria-busy={searching}>
        {results.map((song) => {
          const recent = recentUsage[song.song_id];
          return (
            <div className="row compact-row song-pick-row" key={song.song_id}>
              <div className="row-main">
                <Link href={`/songs/${song.song_id}`} className="row-title">{song.title}</Link>
                <div className="badges compact-badges">
                  {song.matched_source ? <span className="badge">{song.matched_source}</span> : null}
                  {song.default_key ? <span className="badge">{song.default_key}</span> : null}
                  {song.bpm ? <span className="badge">{song.bpm} BPM</span> : null}
                  {recent ? <RecentUsageIcon usage={recent} /> : null}
                </div>
              </div>
              <div className="inline-form nowrap">
                <button className="btn btn-compact" type="button" disabled={isPending} onClick={() => add(song, false)}>Adaugă</button>
                <button className="btn secondary btn-compact" type="button" disabled={isPending} onClick={() => add(song, true)}>Backup</button>
              </div>
            </div>
          );
        })}
      </div>
    </section></details>
  );
}
