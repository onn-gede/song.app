"use client";
import { useEffect, useRef, useState } from "react";
import { YouTubeSuggestion } from "./YouTubeSuggestion";

export function ManualYouTubeSuggestion({ youthCollectionIds }: { youthCollectionIds: string[] }) {
  const root = useRef<HTMLDivElement>(null),
    [title, setTitle] = useState(""),
    [collectionId, setCollectionId] = useState(""),
    [url, setUrl] = useState("");
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const titleInput = form.elements.namedItem("title") as HTMLInputElement | null;
    const collection = form.elements.namedItem("collection_id") as HTMLSelectElement | null;
    const sync = () => {
      setTitle(titleInput?.value || "");
      setCollectionId(collection?.value || "");
    };
    sync();
    titleInput?.addEventListener("input", sync);
    collection?.addEventListener("change", sync);
    return () => {
      titleInput?.removeEventListener("input", sync);
      collection?.removeEventListener("change", sync);
    };
  }, []);
  const isYouth = youthCollectionIds.includes(collectionId);
  return (
    <div ref={root}>
      <label className="label manual-youtube-field">
        Link YouTube <span className="muted small">(opțional)</span>
        <input
          className="input"
          type="url"
          inputMode="url"
          name="youtube_url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
        />
        <small>Poți lipi linkul direct și de pe mobil.</small>
      </label>
      {isYouth ? (
        <>
          <YouTubeSuggestion query={title} collectionId={collectionId} onSelect={setUrl} />
        </>
      ) : null}
    </div>
  );
}
