"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { bulkDeleteSongsAction } from "@/app/(app)/songs/actions";

type SongRow = {
  id: string;
  title: string;
  default_key?: string | null;
  bpm?: number | null;
  structure?: string | null;
  song_sources?: Array<{
    song_number?: string | null;
    source_title?: string | null;
    song_collections?: { id?: string; name?: string; short_code?: string | null } | null;
  }>;
  song_categories?: Array<{ categories?: { id?: string; name?: string; slug?: string } | null }>;
  song_files?: Array<{ import_status?: string | null }>;
};

function firstSourceLabel(song: SongRow) {
  const source = (song.song_sources || [])[0];
  if (!source) return "";
  const code = source.song_collections?.short_code || source.song_collections?.name || "Sursă";
  return `${code}${source.song_number ? ` nr. ${source.song_number}` : ""}`;
}

export function SongsBulkList({ songs }: { songs: SongRow[] }) {
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected = songs.length > 0 && selectedIds.length === songs.length;

  function toggleOne(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAll() {
    setSelectedIds(allVisibleSelected ? [] : songs.map((song) => song.id));
  }

  return (
    <form action={bulkDeleteSongsAction} className="bulk-songs-shell">
      <input type="hidden" name="current_query" value={searchParams.toString()} />
      {selectedIds.map((id) => <input key={id} type="hidden" name="song_ids" value={id} />)}

      <div className="bulk-toolbar">
        <label className="check-inline">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
          <span>Selectează toate afișate</span>
        </label>
        <span className="muted small">{selectedIds.length} selectate</span>
        <input
          className="input bulk-confirm-input"
          name="confirm"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="Scrie STERGE pentru bulk delete"
          disabled={selectedIds.length === 0}
        />
        <button className="btn danger btn-compact" type="submit" disabled={selectedIds.length === 0 || confirm !== "STERGE"}>
          Șterge selectate
        </button>
      </div>

      <div className="list compact-list songs-bulk-list" style={{ marginTop: 14 }}>
        {songs.map((song) => {
          const sources = (song.song_sources || [])
            .map((source) => `${source.song_collections?.short_code || "Sursă"}${source.song_number ? ` nr. ${source.song_number}` : ""}`)
            .join(", ");
          const cats = (song.song_categories || [])
            .map((item) => item.categories?.name)
            .filter(Boolean)
            .join(", ");
          const importStatus = (song.song_files || [])[0]?.import_status;
          const selected = selectedSet.has(song.id);

          return (
            <div className={`row compact-row selectable-song-row${selected ? " selected" : ""}`} key={song.id}>
              <label className="song-select-check" aria-label={`Selectează ${song.title}`}>
                <input type="checkbox" checked={selected} onChange={() => toggleOne(song.id)} />
              </label>
              <Link className="row-main song-row-link" href={`/songs/${song.id}`}>
                <span className="row-title">{song.title}</span>
                <span className="badges compact-badges">
                  {firstSourceLabel(song) ? <span className="badge strong-badge">{firstSourceLabel(song)}</span> : null}
                  {sources && sources !== firstSourceLabel(song) ? <span className="badge">{sources}</span> : null}
                  {cats ? <span className="badge">{cats}</span> : null}
                  {song.default_key ? <span className="badge">Tonalitate: {song.default_key}</span> : null}
                  {song.bpm ? <span className="badge">{song.bpm} BPM</span> : null}
                  {song.structure ? <span className="badge">{song.structure}</span> : null}
                  {importStatus === "needs_review" ? <span className="badge warning">de verificat</span> : null}
                  {importStatus === "approved" ? <span className="badge">verificat</span> : null}
                </span>
              </Link>
            </div>
          );
        })}
        {songs.length === 0 ? <p className="muted">Nu există cântări pentru filtrele selectate.</p> : null}
      </div>
    </form>
  );
}
