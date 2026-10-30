"use client";
import {ProgramChangeTracker} from "./ProgramChangeTracker";
import { createContext, useContext, useState,useEffect, type ReactNode } from "react";
import { latestMeetingSnapshot, type MeetingSnapshot } from "@/lib/meeting-state";
const MeetingContext = createContext<{ snapshot: MeetingSnapshot; apply: (snapshot: MeetingSnapshot) => void } | null>(null);
export function MeetingState({ initial, children,meetingId }: { meetingId?:string;initial: MeetingSnapshot; children: ReactNode }) {
  const [committed, setCommitted] = useState<MeetingSnapshot | null>(null);
  useEffect(()=>{if(!meetingId)return;let alive=true,busy=false;const controller=new AbortController();const update=async()=>{if(busy||document.hidden)return;busy=true;try{const r=await fetch(`/api/meetings/${meetingId}/live?snapshot=1`,{cache:'no-store',signal:controller.signal});const d=await r.json();if(alive&&r.ok&&d.snapshot)setCommitted(old=>latestMeetingSnapshot(d.snapshot,old));}catch{}finally{busy=false;}};const visibility=()=>{if(!document.hidden)void update();};const storage=(e:StorageEvent)=>{try{if(e.key==='songapp:program-updated'&&JSON.parse(e.newValue||'{}').meetingId===meetingId)void update();}catch{}};let channel:BroadcastChannel|undefined;try{channel=new BroadcastChannel('songapp-programs');channel.onmessage=e=>{if(e.data?.meetingId===meetingId)void update();};}catch{}window.addEventListener('focus',visibility);document.addEventListener('visibilitychange',visibility);window.addEventListener('storage',storage);void update();return()=>{alive=false;controller.abort();channel?.close();window.removeEventListener('focus',visibility);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('storage',storage);};},[meetingId]);
  const snapshot = latestMeetingSnapshot(initial, committed);
  return <MeetingContext.Provider value={{ snapshot, apply: next => {setCommitted(previous => latestMeetingSnapshot(next, previous));if(meetingId){try{const channel=new BroadcastChannel('songapp-programs');channel.postMessage({meetingId});channel.close();localStorage.setItem('songapp:program-updated',JSON.stringify({meetingId,at:Date.now()}));}catch{}}} }}><ProgramChangeTracker items={snapshot.items}>{children}</ProgramChangeTracker></MeetingContext.Provider>;
}
export function useMeetingState() { return useContext(MeetingContext); }
export function MeetingActionForm({ action, children, className }: { action: (data: FormData) => Promise<MeetingSnapshot>; children: ReactNode; className?: string }) {
  const state = useMeetingState();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return <form className={className} action={async data => {
    setPending(true);setError("");
    try { const saved = await action(data); state?.apply(saved); }
    catch (err) { setError(err instanceof Error ? err.message : "Salvarea a eșuat."); }
    finally { setPending(false); }
  }}><fieldset disabled={pending} className="meeting-form-fields">{children}</fieldset>{pending ? <p role="status">Salvez…</p> : null}{error ? <p className="error" role="alert">{error}</p> : null}</form>;
}
