"use client";

import { useEffect, useState } from "react";

export function InitialAppLoader() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className={`initial-app-loader${ready ? " is-ready" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Se încarcă SongApp"
      style={{ backgroundColor: "#f5f7f1", color: "#173e2c" }}
    >
      <span aria-hidden="true">♫</span>
      <strong>SongApp</strong>
      <i aria-hidden="true" />
    </div>
  );
}
