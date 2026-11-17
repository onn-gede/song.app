"use client";

import { useRef, useState } from "react";

export function LyricsPasteField() {
  const field = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");
  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) throw new Error("Clipboard gol");
      const textarea = field.current;
      if (!textarea) return;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? start;
      textarea.setRangeText(text, start, end, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.focus();
      setMessage("Versurile au fost lipite.");
    } catch {
      setMessage("Ține apăsat în câmp și alege Lipește. Browserul nu a permis accesul direct la clipboard.");
      field.current?.focus();
    }
  }
  return (
    <div className="lyrics-paste-field">
      <label className="label" htmlFor="manual-lyrics">Versuri <span className="muted small">(opțional)</span></label>
      <textarea ref={field} id="manual-lyrics" className="textarea import-lyrics" name="lyrics_text" autoCapitalize="sentences" autoCorrect="on" spellCheck placeholder={"Strofa 1\n...\n\nRefren\n...\n\nStrofa 2\n..."} />
      <div className="inline-form mobile-paste-actions">
        <button className="btn secondary btn-compact" type="button" onClick={paste}>Lipește din clipboard</button>
        {message ? <span className="muted small" role="status">{message}</span> : null}
      </div>
    </div>
  );
}
