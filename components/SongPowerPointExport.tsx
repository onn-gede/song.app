"use client";

import { useState } from "react";
import { buildSongPptx, safeSongPptxFileName, type SongPptxSection } from "@/lib/song-pptx";

type Props = {
  title: string;
  number?: string | null;
  sections: SongPptxSection[];
};

export function SongPowerPointExport({ title, number, sections }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/templates/songapp-song-template.pptx", { cache: "force-cache" });
      if (!response.ok) throw new Error("Șablonul PowerPoint nu este disponibil.");
      const bytes = await buildSongPptx(await response.arrayBuffer(), { title, number, sections });
      const blob = new Blob([new Uint8Array(bytes).buffer], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeSongPptxFileName(title, number);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Exportul PowerPoint nu a reușit.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button className="btn secondary btn-compact" type="button" onClick={() => void download()} disabled={busy}>
      {busy ? "Se pregătește…" : "Exportă PPTX ↓"}
    </button>
    {error ? <span className="error small" role="alert">{error}</span> : null}
  </>;
}
