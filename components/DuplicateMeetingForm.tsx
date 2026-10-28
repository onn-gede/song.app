"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MeetingDatePicker } from "./MeetingDatePicker";
import { duplicateMeetingAction } from "@/app/(app)/meetings/actions";
export function DuplicateMeetingForm({ meetingId, title }: { meetingId: string; title: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return <details className="card"><summary>Folosește acest program ca model</summary>
    <p className="muted small">Copiază ordinea, cântările, textele și rezervele într-un program nou. Linkurile publice și propunerile rămân la programul original.</p>
    <form className="form-grid" onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget); setError("");
      start(async () => {
        try { const id = await duplicateMeetingAction({ meetingId, title: String(data.get("title") || ""), meetingDate: String(data.get("meeting_date") || "") }); router.push(`/meetings/${id}`); }
        catch(error) { setError(error instanceof Error ? error.message : "Copierea a eșuat."); }
      });
    }}>
      <label className="label">Titlul noului program<input className="input" name="title" defaultValue={`${title} — copie`} required maxLength={200} /></label>
      <MeetingDatePicker disabled={pending}/>
      <button className="btn" disabled={pending}>{pending ? "Se copiază..." : "Creează copia"}</button>
      {error ? <p className="error" role="alert">{error}</p> : null}
    </form>
  </details>;
}
