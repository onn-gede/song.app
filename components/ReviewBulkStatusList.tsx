"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateImportStatusAction, type BulkImportStatusState } from "@/app/(app)/review/actions";
import { formatDateTime } from "@/lib/format";

type ImportFileRow = {
  id: string;
  file_name: string;
  import_status: string | null;
  parser_notes: string | null;
  created_at: string;
  songs: any;
  song_collections: any;
};

type Props = {
  files: ImportFileRow[];
};

const initialState: BulkImportStatusState = { ok: false };

function statusLabel(status?: string | null) {
  if (status === "approved") return "Verificat";
  if (status === "needs_review") return "Necesită verificare";
  if (status === "parsed") return "Extras automat";
  if (status === "failed") return "Import eșuat";
  if (status === "pending") return "În așteptare";
  return "Fără status";
}

function BulkSubmitButton({ selectedCount, pending }: { selectedCount: number; pending: boolean }) {
  return (
    <button className="btn btn-compact" type="submit" disabled={selectedCount === 0 || pending}>
      {pending ? "Se salvează..." : `Schimbă statusul (${selectedCount})`}
    </button>
  );
}

export function ReviewBulkStatusList({ files }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState(bulkUpdateImportStatusAction, initialState);
  const allSelected = files.length > 0 && selected.size === files.length;

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  useEffect(() => {
    if (state.ok) {
      setSelected(new Set());
      router.refresh();
    }
  }, [state.ok, state.updated, router]);

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(files.map((file) => file.id)));
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="form-grid">
      <div className="bulk-toolbar">
        <label className="check-inline bulk-check">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          Selectează toate afișate
        </label>
        <div className="inline-form nowrap">
          <select className="select compact-select" name="status" defaultValue="approved" disabled={pending}>
            <option value="needs_review">Necesită verificare</option>
            <option value="parsed">Extras automat</option>
            <option value="approved">Verificat</option>
            <option value="pending">În așteptare</option>
            <option value="failed">Eșuat</option>
          </select>
          <BulkSubmitButton selectedCount={selected.size} pending={pending} />
        </div>
      </div>

      {selectedIds.map((id) => <input key={id} type="hidden" name="file_ids" value={id} />)}

      {pending ? <div className="notice">Se actualizează statusul pentru {selected.size} importuri...</div> : null}
      {state.message ? <div className="notice success">{state.message}</div> : null}
      {state.error ? <div className="error">{state.error}</div> : null}

      <div className="list compact-list">
        {files.map((file: any) => {
          const song = Array.isArray(file.songs) ? file.songs[0] : file.songs;
          const collection = Array.isArray(file.song_collections) ? file.song_collections[0] : file.song_collections;
          const checked = selected.has(file.id);
          return (
            <div className={`row compact-row review-select-row ${checked ? "is-selected" : ""}`} key={file.id}>
              <label className="import-row-check" aria-label="Selectează import">
                <input type="checkbox" checked={checked} onChange={() => toggleOne(file.id)} disabled={pending} />
              </label>
              <div className="row-main">
                <div className="row-title">{song?.title || file.file_name}</div>
                <div className="badges compact-badges">
                  <span className={file.import_status === "approved" ? "badge" : "badge warning"}>{statusLabel(file.import_status)}</span>
                  {collection?.short_code ? <span className="badge">{collection.short_code}</span> : null}
                  {song?.default_key ? <span className="badge">Tonalitate: {song.default_key}</span> : null}
                  {song?.bpm ? <span className="badge">{song.bpm} BPM</span> : null}
                </div>
                <p className="muted small" style={{ margin: "6px 0 0" }}>
                  {file.file_name} · importat {formatDateTime(file.created_at)}
                </p>
                {file.parser_notes ? <p className="small compact-note-clean">{file.parser_notes}</p> : null}
              </div>
              <div className="inline-form nowrap">
                {song?.id ? <Link className="btn secondary btn-compact" href={`/songs/${song.id}`}>Vezi</Link> : null}
                {song?.id ? <Link className="btn btn-compact" href={`/songs/${song.id}/lyrics`}>Verifică versuri</Link> : null}
              </div>
            </div>
          );
        })}
        {files.length === 0 ? <p className="muted">Nu există importuri pentru filtrul ales.</p> : null}
      </div>
    </form>
  );
}
