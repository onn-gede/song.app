"use client";

import { useState, useTransition } from "react";
import { addPublicSongContributionAction, publicSearchSongsAction, type PublicPositionOption, type PublicSongSearchResult } from "@/app/program/actions";

function compactLyrics(text?: string | null) {
  return (text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join("\n");
}

export function PublicContributionPanel({ slug, positionOptions }: { slug: string; positionOptions: PublicPositionOption[] }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [proposedPosition, setProposedPosition] = useState("");
  const [results, setResults] = useState<PublicSongSearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openStatus(nextMessage: string | null, nextError: string | null = null) {
    setMessage(nextMessage);
    setError(nextError);
    setModalOpen(true);
  }

  function selectedPositionNumber() {
    const parsed = Number(proposedPosition);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function search() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const data = await publicSearchSongsAction(slug, query);
        setResults(data);
        if (data.length === 0) openStatus("Nu am găsit cântări pentru această căutare.");
      } catch (err) {
        openStatus(null, err instanceof Error ? err.message : "Căutarea a eșuat.");
      }
    });
  }

  function add(song: PublicSongSearchResult, isBackup: boolean) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await addPublicSongContributionAction({
          slug,
          songId: song.song_id,
          isBackup,
          proposedPosition: selectedPositionNumber(),
          contributorName: name || null,
          notes: notes || null
        });
        openStatus("Propunerea a fost trimisă. Va apărea discret cu roșu până este aprobată.");
      } catch (err) {
        openStatus(null, err instanceof Error ? err.message : "Nu am putut trimite propunerea.");
      }
    });
  }

  return (
    <section className="card public-edit-card print-hide">
      <div className="top-row public-edit-header">
        <div>
          <div className="eyebrow">Propuneri externe</div>
          <h2>Adaugă în program</h2>
          <p className="muted small">Propune cântări sau intervenții. Poți indica și poziția dorită în program.</p>
        </div>
      </div>

      <div className="public-edit-grid public-edit-grid-v38">
        <label className="label">Numele tău, opțional
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Andrei" />
        </label>
        <label className="label">Poziție propusă
          <select className="select" value={proposedPosition} onChange={(event) => setProposedPosition(event.target.value)}>
            <option value="">La finalul programului</option>
            {positionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="label">Notă, opțional
          <input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex: cântare de final" />
        </label>
      </div>

      <div className="public-contribution-block">
        <h3>Caută cântare</h3>
        <div className="inline-form public-search-row">
          <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută după titlu, număr sau text, cu/fără diacritice" onKeyDown={(event) => { if (event.key === "Enter") search(); }} />
          <button className="btn btn-compact" type="button" disabled={isPending} onClick={search}>{isPending ? "Caut…" : "Caută"}</button>
        </div>
        <div className="list compact-list public-search-results-list">
          {results.map((song) => (
            <div className="row compact-row public-search-result" key={song.song_id}>
              <div className="row-main public-result-main">
                <div className="row-title public-result-title">{song.title}</div>
                <div className="badges compact-badges">
                  {song.matched_source ? <span className="badge">{song.matched_source}</span> : null}
                </div>
                {song.lyrics_text ? (
                  <details className="public-result-lyrics">
                    <summary>Vezi versurile</summary>
                    <pre>{compactLyrics(song.lyrics_text)}</pre>
                  </details>
                ) : null}
              </div>
              <div className="inline-form nowrap">
                <button className="btn btn-compact" type="button" disabled={isPending} onClick={() => add(song, false)}>Propune</button>
                <button className="btn secondary btn-compact" type="button" disabled={isPending} onClick={() => add(song, true)}>Backup</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen ? (
        <div className="inline-modal-backdrop" role="dialog" aria-modal="true">
          <div className="inline-modal-card">
            <h3>{error ? "Nu am putut finaliza" : "Confirmare"}</h3>
            <p className={error ? "error" : "success"}>{error || message}</p>
            <button className="btn btn-compact" type="button" onClick={() => setModalOpen(false)}>Închide</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
