"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cancelExternalSyncRunAction, getExternalSyncRunsAction, startExternalSyncAction } from "@/app/(app)/external-sources/actions";

type Run = {
  id: string;
  status: string;
  pages_scanned: number;
  found_count: number;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  error_count?: number;
  heartbeat_at?: string | null;
  error_message?: string | null;
  started_at: string;
  finished_at?: string | null;
  external_sources?: { name?: string | null; slug?: string | null } | null;
};

function RunRow({ run, onCancel }: { run: Run; onCancel: (id: string) => void }) {
  const processed = (run.imported_count || 0) + (run.updated_count || 0) + (run.skipped_count || 0) + (run.error_count || 0);
  const total = run.found_count || 0;
  const percent = total ? Math.min(100, Math.round((processed / total) * 100)) : run.status === "running" ? 15 : 0;
  const isRunning = ["queued", "running"].includes(run.status);
  const waiting = isRunning && (!run.heartbeat_at || Date.now() - new Date(run.heartbeat_at).getTime() > 120000);
  const statusLabel = run.status === "cancelled" ? "anulată" : run.status === "finished" ? (run.error_count ? "finalizată cu erori" : "finalizată") : run.status === "failed" ? "eroare" : run.status === "queued" ? "în așteptare" : "în rulare";

  return (
    <div className="row compact-row external-run-row">
      <span className="row-main">
        <span className="row-title">{run.external_sources?.name || "Resurse Creștine"} · {statusLabel}</span>
        <span className="muted small">
          Pagini: {run.pages_scanned || 0} · găsite: {total} · procesate: {processed}/{total || "?"} · importate: {run.imported_count || 0} · actualizate: {run.updated_count || 0} · nemodificate: {run.skipped_count || 0} · erori: {run.error_count || 0}
        </span>
        {waiting ? <span className="muted small">Așteaptă preluarea sau reluarea de către procesul de sincronizare.</span> : null}
        {isRunning ? (
          <span className="progress-line" aria-label={`Progres ${percent}%`}><span style={{ width: `${percent}%` }} /></span>
        ) : null}
        {run.error_message ? <span className="error small">{run.error_message}</span> : null}
      </span>
      {isRunning ? <button className="btn secondary btn-compact" type="button" onClick={() => onCancel(run.id)}>Anulează</button> : null}
    </div>
  );
}

function SyncCard({ onStarted }: { onStarted: () => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    setMessage("Se trimite cererea de sincronizare...");
    startTransition(async () => {
      try {
        await startExternalSyncAction(formData);
        await onStarted();
        setMessage("Sincronizarea este în coadă. Poți închide pagina; procesul de sincronizare o va prelua automat.");
      } catch (error: any) {
        setMessage(error?.message || "Nu am putut porni sincronizarea.");
      }
    });
  }

  return (
    <section className="card compact-card external-source-card">
      <h2>Resurse Creștine</h2>
      <p className="muted small">Import limitat la titlu și versuri. Strofă/Refren sunt păstrate ca secțiuni separate. Începe cu loturi mici.</p>
      <form ref={formRef} onSubmit={onSubmit} className="form-grid">
        <input type="hidden" name="source" value="resursecrestine" />
        <div className="form-two">
          <label className="label">Pagini de scanat<input className="input" name="pages" type="number" min="1" max="10" defaultValue="1" /></label>
          <label className="label">Max. cântări/import<input className="input" name="max_songs" type="number" min="1" max="200" defaultValue="25" /></label>
        </div>
        <label className="check-row compact-check-row"><input type="checkbox" name="overwrite" /> <span><strong>Actualizează existente</strong><small>Suprascrie doar titlul și versurile dacă sursa s-a modificat.</small></span></label>
        <button className="btn" type="submit" disabled={isPending}>{isPending ? "Pornește..." : "Sincronizează Resurse Creștine"}</button>
        {message ? <p className="muted small sync-note">{message}</p> : null}
      </form>
    </section>
  );
}

export function ExternalSourcesSyncPanel({ initialRuns }: { initialRuns: Run[] }) {
  const [refreshError, setRefreshError] = useState("");
  const [runs, setRuns] = useState<Run[]>(initialRuns || []);
  const [isCancelling, startCancelTransition] = useTransition();
  const hasRunning = useMemo(() => runs.some((run) => ["queued", "running"].includes(run.status)), [runs]);

  async function refreshRuns() {
    try {
      const nextRuns = await getExternalSyncRunsAction() as Run[];
      setRuns(nextRuns);
    } catch {
      // păstrăm ultima stare afișată
    }
  }

  function cancelRun(runId: string) {
    startCancelTransition(async () => {
      try { await cancelExternalSyncRunAction(runId); await refreshRuns(); setRefreshError(""); }
      catch (error) { setRefreshError(error instanceof Error ? error.message : "Anularea a eșuat."); }
    });
  }

  useEffect(() => {
    if (!hasRunning) return;
    let mounted = true;
    let inFlight = false;
    async function refresh() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const nextRuns = await getExternalSyncRunsAction() as Run[];
        if (mounted) { setRuns(nextRuns); setRefreshError(""); }
      } catch {
        if (mounted) setRefreshError("Progresul nu se poate actualiza momentan. Se reîncearcă automat.");
      } finally { inFlight = false; }
    }
    const interval = setInterval(refresh, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, [hasRunning]);

  return (
    <>
      <div className="grid external-source-grid">
        <SyncCard onStarted={refreshRuns} />
      </div>

      <section className="card compact-card" style={{ marginTop: 16 }}>
        <div className="section-header-row">
          <h2>Ultimele sincronizări</h2>
          <span className="muted small">Afișăm ultimele 10 rulări. {isCancelling ? "Se anulează..." : ""}</span>
        </div>
        {refreshError ? <p className="error" role="status">{refreshError}</p> : null}
        <div className="list compact-list">
          {runs.slice(0, 10).map((run) => <RunRow key={run.id} run={run} onCancel={cancelRun} />)}
          {runs.length === 0 ? <p className="muted">Nu există sincronizări încă.</p> : null}
        </div>
      </section>
    </>
  );
}
