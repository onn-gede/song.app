"use client";
import { useEffect, useRef, useState } from "react";
import { youtubePrivacyEmbedUrl } from "@/lib/youtube";
import { Icon } from "./Icon";

export function YouTubePlayButton({ url, title }: { url: string; title: string }) {
  const embed = youtubePrivacyEmbedUrl(url),
    dialog = useRef<HTMLDialogElement>(null),
    [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, [open]);
  if (!embed) return null;
  return (
    <>
      <button
        type="button"
        className="youtube-play-button print-hide"
        onClick={() => setOpen(true)}
        title={`Redă ${title} pe YouTube`}
        aria-label={`Redă ${title} pe YouTube`}
      >
        <Icon name="play" size={14} />
        <span>YouTube</span>
      </button>
      {open ? (
        <dialog
          ref={dialog}
          className="dialog youtube-dialog"
          onCancel={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
          onClick={(event) => {
            if (event.target === dialog.current) setOpen(false);
          }}
        >
          <div className="modal-header">
            <div>
              <div className="eyebrow">YouTube</div>
              <h2>{title}</h2>
            </div>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Închide">
              ×
            </button>
          </div>
          <div className="youtube-embed-wrap">
            <iframe
              src={`${embed}?autoplay=1`}
              title={`YouTube · ${title}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="inline-form">
            <a className="btn secondary btn-compact" href={url} target="_blank" rel="noreferrer">
              Deschide în YouTube
            </a>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
