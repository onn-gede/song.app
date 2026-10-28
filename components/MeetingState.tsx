"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { latestMeetingSnapshot, type MeetingSnapshot } from "@/lib/meeting-state";
const MeetingContext = createContext<{ snapshot: MeetingSnapshot; apply: (snapshot: MeetingSnapshot) => void } | null>(null);
export function MeetingState({ initial, children }: { initial: MeetingSnapshot; children: ReactNode }) {
  const [committed, setCommitted] = useState<MeetingSnapshot | null>(null);
  const snapshot = latestMeetingSnapshot(initial, committed);
  return <MeetingContext.Provider value={{ snapshot, apply: next => setCommitted(previous => latestMeetingSnapshot(next, previous)) }}>{children}</MeetingContext.Provider>;
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
