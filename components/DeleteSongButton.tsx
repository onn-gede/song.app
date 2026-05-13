"use client";

import { useState } from "react";
import { deleteSongAction } from "@/app/(app)/songs/actions";

export function DeleteSongButton({ songId, songTitle }: { songId: string; songTitle: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="song-delete-footer">
      <button className="link-danger small" type="button" onClick={() => setOpen(true)}>
        Șterge cântarea
      </button>

      {open ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <div className="dialog delete-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="eyebrow">Confirmare ștergere</div>
                <h2>Șterge cântarea</h2>
              </div>
              <button className="icon-btn" type="button" onClick={() => setOpen(false)} aria-label="Închide">×</button>
            </div>
            <p className="muted small">
              Cântarea <strong>{songTitle}</strong> și datele asociate vor fi șterse. Pentru confirmare scrie exact <strong>STERGE</strong>.
            </p>
            <form action={deleteSongAction} className="form-grid">
              <input type="hidden" name="song_id" value={songId} />
              <input className="input" name="confirm" placeholder="STERGE" required />
              <div className="inline-form modal-actions">
                <button className="btn danger btn-compact" type="submit">Șterge definitiv</button>
                <button className="btn secondary btn-compact" type="button" onClick={() => setOpen(false)}>Renunță</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
