"use client";

import { useEffect, useState } from "react";
import { DEFAULT_FREESHOW_URL, freeShowConnectorHealthUrl } from "@/lib/freeshow-local";

const STORAGE_URL = "songapp:freeshow-url";
type ConnectorState = { online: boolean; message: string };

export function FreeShowConnectorStatus() {
  const [state, setState] = useState<ConnectorState>({ online: false, message: "Se verifică starea conectorului…" });

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    async function check() {
      controller?.abort();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 2500);
      try {
        const stored = window.localStorage.getItem(STORAGE_URL) || DEFAULT_FREESHOW_URL;
        const response = await fetch(freeShowConnectorHealthUrl(stored), {
          cache: "no-store",
          credentials: "omit",
          referrerPolicy: "no-referrer",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("offline");
        const result = await response.json() as { ok?: boolean; freeshowConnected?: boolean };
        if (!active || !result.ok) throw new Error("offline");
        const freeShowText = result.freeshowConnected === false ? " FreeShow nu răspunde încă." : " FreeShow este disponibil.";
        setState({ online: true, message: `Conector activ.${freeShowText}` });
      } catch {
        if (active) setState({ online: false, message: "Conector oprit sau indisponibil pe acest calculator." });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void check();
    const interval = window.setInterval(() => void check(), 15000);
    const refresh = () => void check();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return <div
    className={`workspace-connector-status ${state.online ? "online" : "offline"}`}
    data-status={state.message}
    title={state.message}
    aria-label={`FreeShow Sync: ${state.message}`}
    tabIndex={0}
  >
    <span className="workspace-connector-dot" aria-hidden="true"/>
    <span>FreeShow Sync</span>
  </div>;
}
