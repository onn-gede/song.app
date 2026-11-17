"use client";

import { useState } from "react";
import { youtubePrivacyEmbedUrl } from "@/lib/youtube";

export function YouTubePlayer({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const embed = youtubePrivacyEmbedUrl(url);
  if (!embed) return null;
  return (
    <section className="card youtube-song-card">
      <div>
        <div className="eyebrow">Audio asociat</div>
        <h2>YouTube</h2>
      </div>
      {playing ? (
        <div className="youtube-embed-wrap">
          <iframe src={embed} title={`YouTube · ${title}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <div className="inline-form">
          <button className="btn btn-compact" type="button" onClick={() => setPlaying(true)}>Redă în SongApp</button>
          <a className="btn secondary btn-compact" href={url} target="_blank" rel="noreferrer">Deschide YouTube</a>
        </div>
      )}
      <p className="muted small">Playerul se încarcă doar când apeși Redă.</p>
    </section>
  );
}

