"use client";
import { useMeetingState } from "./MeetingState";
import { useState, useTransition } from "react";
import { saveMeetingResponsiblesAction } from "@/app/(app)/meetings/actions";

export function MeetingResponsibles({ meetingId, principal, secondary, editable }: { meetingId: string; principal: string | null; secondary: string[]; editable: boolean }) {
  const state = useMeetingState();
  if (state) { principal = state.snapshot.principal; secondary = state.snapshot.secondary; }
  const [names, setNames] = useState(secondary.length ? secondary : [""]);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  if (!editable) return <section className="meeting-responsibles"><h3>Responsabili</h3><p><strong>Principal:</strong> {principal || "Nespecificat"}</p>{secondary.length > 0 ? <p><strong>Secundari:</strong> {secondary.join(", ")}</p> : null}</section>;
  return <section className="meeting-responsibles print-hide">
    <div className="responsibles-heading"><h3>Echipă</h3><button className="btn secondary btn-compact" type="button" disabled={pending} aria-expanded={editing} onClick={() => setEditing(!editing)}>{editing ? "Închide" : "Editează echipa"}</button></div>
    {!editing ? <div className="responsibles-summary"><span><strong>Principal:</strong> {principal || "Nespecificat"}</span>{secondary.length ? <span><strong>Secundari:</strong> {secondary.join(", ")}</span> : null}</div> : null}
    {editing ? <form action={data => startTransition(async () => {
      setStatus("");
      try { const saved = await saveMeetingResponsiblesAction(data); state?.apply(saved); setNames(saved.secondary.length ? saved.secondary : [""]); setStatus(""); setEditing(false); }
      catch (err) { setStatus(err instanceof Error ? err.message : "Salvarea a eșuat."); }
    })}>
      <input type="hidden" name="meeting_id" value={meetingId} />
      <label className="label">Responsabil principal<input className="input input-tight" name="principal_responsible" defaultValue={principal || ""} placeholder="Nume" maxLength={120} /></label>
      <div className="secondary-responsibles">{names.map((name, index) => <div className="secondary-responsible" key={index}>
        <label className="label">Secundar {index + 1}<input className="input input-tight" name="secondary_responsible" value={name} onChange={event => setNames(names.map((value, i) => i === index ? event.target.value : value))} maxLength={120} placeholder="Nume" /></label>
        <button className="icon-btn" type="button" disabled={pending} aria-label={`Elimină secundarul ${index + 1}`} onClick={() => setNames(names.filter((_, i) => i !== index))}>×</button>
      </div>)}</div>
      <div className="inline-form"><button className="btn secondary btn-compact" type="button" disabled={pending || names.length >= 20} onClick={() => setNames([...names, ""])}>+ Responsabil secundar</button><button className="btn btn-compact" disabled={pending}>{pending ? "Salvez…" : "Salvează responsabilii"}</button></div>
    </form> : null}
    {status ? <p role="status" className="small">{status}</p> : null}
  </section>;
}
