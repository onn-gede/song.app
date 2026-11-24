"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";
import type { YouTubeSuggestionResult } from "@/lib/youtube-suggestions";

type Payload = {
  configured: boolean;
  searchUrl: string;
  results: YouTubeSuggestionResult[];
  warning?: string;
};
export function YouTubeSuggestion({
  query,
  collectionId,
  songId,
  onSelect,
}: {
  query: string;
  collectionId?: string;
  songId?: string;
  onSelect: (url: string) => void;
}) {
  const [payload, setPayload] = useState<Payload | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const title = query.trim();
    if (title.length < 2 || (!collectionId && !songId)) {
      setPayload(null);
      setError("");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ q: title });
      if (collectionId) params.set("collectionId", collectionId);
      if (songId) params.set("songId", songId);
      requestJson<Payload>(`/api/youtube/suggestions?${params}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(setPayload)
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : "Căutarea YouTube nu este disponibilă.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 650);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, collectionId, songId]);
  if (!collectionId && !songId) return null;
  return (
    <section className="youtube-suggestions" aria-live="polite">
      <div className="top-row">
        <strong>Sugestii YouTube</strong>
        {loading ? <span className="muted small">Se caută…</span> : null}
      </div>
      {payload?.results.map((item) => (
        <article className="youtube-suggestion-row" key={item.videoId}>
          {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" width="96" height="54" /> : null}
          <div>
            <strong>{item.title}</strong>
            <small>{item.channel}</small>
          </div>
          <button className="btn secondary btn-compact" type="button" onClick={() => onSelect(item.url)}>
            Folosește linkul
          </button>
        </article>
      ))}
      {payload && !payload.results.length ? (
        <p className="muted small">
          {payload.warning ||
            (!payload.configured
              ? "Căutarea automată nu este configurată pe server. Poți căuta și confirma manual linkul."
              : "Nu am găsit o sugestie clară.")}{" "}
          <a href={payload.searchUrl} target="_blank" rel="noreferrer">
            Caută pe YouTube ↗
          </a>
        </p>
      ) : null}
      {error ? <p className="muted small">{error}</p> : null}
    </section>
  );
}
