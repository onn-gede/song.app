"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AddSongToMeeting } from "./AddSongToMeeting";
import { RecentUsageIcon } from "@/components/RecentUsageIcon";
import { getRecentUsageAction, searchSongsAction, type RecentUsage, type SongSearchResult } from "@/app/(app)/meetings/actions";

export function SongSearch({ autofocus = false }: { autofocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [recent, setRecent] = useState<Record<string, RecentUsage>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentUsage() {
      try {
        const map = await getRecentUsageAction(30);
        if (!cancelled) setRecent(map);
      } catch (error) {
        if (!cancelled) console.warn("Nu am putut încărca istoricul recent:", error);
      }
    }

    void loadRecentUsage();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const handle = window.setTimeout(async () => {
      try {
        const data = await searchSongsAction(trimmed, 25);
        if (!cancelled) setResults(data);
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "Căutarea a eșuat.");
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  const helper = useMemo(() => {
    if (query.trim().length < 2) return "Caută după titlu, versuri, cuvinte fără diacritice sau număr.";
    if (loading) return "Se caută...";
    return `${results.length} rezultate`;
  }, [loading, query, results.length]);

  return (
    <section className="card grid">
      <input
        className="input big-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Caută o cântare... ex: 352, Isus, har, cruce, furtuni"
        autoFocus={autofocus}
      />
      <div className="muted small">{helper}</div>

      {error ? <p className="error">{error}</p> : null}

      <div className="list compact-list">
        {results.map((song) => {
          const usage = recent[song.song_id];
          return (
            <div className="row compact-row" key={song.song_id}>
              <div className="row-main">
                <Link href={`/songs/${song.song_id}`} className="row-title">{song.title}</Link>
                <div className="badges compact-badges">
                  {song.matched_source ? <span className="badge">{song.matched_source}</span> : null}
                  {song.default_key ? <span className="badge">Tonalitate: {song.default_key}</span> : null}
                  {song.bpm ? <span className="badge">{song.bpm} BPM</span> : null}
                  {usage ? <RecentUsageIcon usage={usage} /> : null}
                </div>
              </div>
              <AddSongToMeeting songId={song.song_id} songTitle={song.title} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
