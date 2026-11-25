"use client";

import { useEffect, useState } from "react";
import { AppLoaderContent } from "./AppLoaderContent";

export function InitialAppLoader() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const delay = 1800;
    const visibleFor = 4000;
    const elapsed = performance.now();
    if (elapsed < delay) {
      setReady(true);
      return;
    }
    const remaining = Math.max(0, delay + visibleFor - elapsed);
    const timer = window.setTimeout(() => setReady(true), remaining);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div
      className={`initial-app-loader app-global-loader${ready ? " is-ready" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Se încarcă SongApp"
      style={{ backgroundColor: "#f5f7f1", color: "#173e2c" }}
    >
      <AppLoaderContent />
    </div>
  );
}
