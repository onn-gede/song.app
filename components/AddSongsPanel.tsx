"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSongToMeetingAction, getBibleVerseSuggestionsAction, searchSongsAction, type RecentUsage, type SongSearchResult } from "@/app/(app)/meetings/actions";
import { RecentUsageIcon } from "@/components/RecentUsageIcon";
export function AddSongsPanel({ meetingId, recentUsage = {} }: { meetingId: string; recentUsage?: Record<string, RecentUsage> }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [verseSuggestions, setVerseSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;

    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const handle = window.setTimeout(async () => {
      try {
        const data = await searchSongsAction(trimmed, 15);
        if (!cancelled) setResults(data);
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : "Căutarea a eșuat.");
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  function add(song: SongSearchResult, isBackup: boolean) {
    setMessage(null);
    setError(null);
    setVerseSuggestions([]);
    //here implement the suggestions of bible verses API
    startTransition(async () => {
      try {
        const bibleVerses = await getBibleVerseSuggestionsAction(song.title);
        console.log("Suggested Bible verses for", song.title, ":", bibleVerses);  
        await addSongToMeetingAction({
          meetingId,
          songId: song.song_id,
          isBackup,
          selectedKey: song.default_key,
          notes: null
        });
        setVerseSuggestions(bibleVerses);
        setMessage(isBackup ? "Cântarea a fost adăugată ca backup." : "Cântarea a fost adăugată în program.");
        window.setTimeout(() => router.refresh(), 2400);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Nu am putut adăuga cântarea.");
      }
    });
  }

  return (
    <section className="card grid">
      <div>
        <div className="eyebrow">Adaugă cântări</div>
        <h2>Caută și adaugă</h2>
        <p className="muted small">Caută după titlu, versuri sau număr. Pictograma mică indică folosire recentă în alt program.</p>
      </div>
      {message ? <p className="success">{message}</p> : null}
      {verseSuggestions.length > 0 ? (
        <div className="card-soft">
          <div className="eyebrow">Versete sugerate</div>
          <div className="list">
            {verseSuggestions.map((suggestion, index) => (
              <div key={index} className="row compact-row" style={{ padding: "12px 14px", background: "rgba(246,247,250,.9)" }}>
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută după titlu, versuri sau număr (ex: 352)" />
      <div className="list compact-list">
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
    </section>
  );
}
