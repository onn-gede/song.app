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
      <input type="hidden" name="youtube_url" value={url} />
      {isYouth ? (
        <>
          <label className="label">
            Link YouTube confirmat
            <input
              className="input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Alege o sugestie sau lipește un link"
            />
          </label>
          <YouTubeSuggestion query={title} collectionId={collectionId} onSelect={setUrl} />
        </>
      ) : null}
    </div>
  );
}
