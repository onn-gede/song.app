"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copiază link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="btn secondary btn-compact" type="button" onClick={copy}>
      {copied ? "Copiat" : label}
    </button>
  );
}
