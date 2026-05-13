"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateInputValue } from "@/lib/format";
import { createMeetingAction } from "@/app/(app)/meetings/actions";

export function CreateMeetingModal() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button className="btn" type="button" onClick={() => setOpen(true)}>
        + Creează program nou
      </button>
      {open ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <div
            ref={dialogRef}
            className="dialog modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-meeting-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">Program nou</div>
                <h2 id="create-meeting-title">Creează întâlnire / playlist</h2>
              </div>
              <button className="icon-btn" type="button" onClick={() => setOpen(false)} aria-label="Închide">
                ×
              </button>
            </div>
            <form action={createMeetingAction} className="form-grid">
              <label className="label">
                Titlu
                <input className="input" name="title" placeholder="Duminică dimineața" required autoFocus />
              </label>
              <label className="label">
                Tip întâlnire
                <input className="input" name="meeting_type" placeholder="duminica_dimineata / tineret / rugaciune" />
              </label>
              <label className="label">
                Data și ora
                <input className="input" name="meeting_date" type="datetime-local" defaultValue={formatDateInputValue()} required />
              </label>
              <label className="label">
                Note
                <textarea className="textarea" name="notes" placeholder="Detalii interne" />
              </label>
              <div className="inline-form modal-actions">
                <button className="btn" type="submit">Creează program</button>
                <button className="btn secondary" type="button" onClick={() => setOpen(false)}>Renunță</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
