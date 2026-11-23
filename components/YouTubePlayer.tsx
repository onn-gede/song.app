"use client";

import { useState } from "react";
import { youtubePrivacyEmbedUrl, youtubeThumbnailUrl } from "@/lib/youtube";

export function YouTubePlayer({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const embed = youtubePrivacyEmbedUrl(url);
  const thumbnail = youtubeThumbnailUrl(url);
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
        <div className="youtube-song-preview">
          {thumbnail ? <button className="youtube-song-thumbnail" type="button" onClick={() => setPlaying(true)} aria-label={`Redă ${title} în SongApp`}>
            <img src={thumbnail} alt={`Previzualizare YouTube pentru ${title}`} width="160" height="90" loading="lazy" referrerPolicy="no-referrer" />
            <span aria-hidden="true">▶</span>
          </button> : null}
          <div className="inline-form youtube-song-actions">
            <button className="btn btn-compact" type="button" onClick={() => setPlaying(true)}>Redă în SongApp</button>
            <a className="btn secondary btn-compact" href={url} target="_blank" rel="noreferrer">Deschide YouTube</a>
          </div>
        </div>
      )}
      <p className="muted small">Playerul se încarcă doar când apeși Redă.</p>
    </section>
  );
}

