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
  error_message?: string | null;
  started_at: string;
  finished_at?: string | null;
  external_sources?: { name?: string | null; slug?: string | null } | null;
};

function RunRow({ run, onCancel }: { run: Run; onCancel: (id: string) => void }) {
  const processed = (run.imported_count || 0) + (run.updated_count || 0) + (run.skipped_count || 0);
  const total = run.found_count || 0;
  const percent = total ? Math.min(100, Math.round((processed / total) * 100)) : run.status === "running" ? 15 : 0;
  const isRunning = run.status === "running";
  const statusLabel = run.status === "cancelled" ? "anulată" : run.status === "finished" ? "finalizată" : run.status === "failed" ? "eroare" : "în rulare";

  return (
    <div className="row compact-row external-run-row">
      <span className="row-main">
        <span className="row-title">{run.external_sources?.name || "Resurse Creștine"} · {statusLabel}</span>
        <span className="muted small">
          Pagini: {run.pages_scanned || 0} · găsite: {total} · procesate: {processed}/{total || "?"} · importate: {run.imported_count || 0} · actualizate: {run.updated_count || 0} · sărite: {run.skipped_count || 0}
        </span>
        {isRunning ? (
          <span className="progress-line" aria-label={`Progres ${percent}%`}><span style={{ width: `${percent}%` }} /></span>
        ) : null}
        {run.error_message ? <span className="error small">{run.error_message}</span> : null}
      </span>
      {isRunning ? <button className="btn secondary btn-compact" type="button" onClick={() => onCancel(run.id)}>Cancel</button> : null}
    </div>
  );
}

function SyncCard() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    setMessage("Sincronizarea a pornit. Poți pleca de pe pagină; progresul rămâne în istoricul de mai jos cât timp serverul local rulează.");
    startTransition(async () => {
      try {
        await startExternalSyncAction(formData);
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
  const [runs, setRuns] = useState<Run[]>(initialRuns || []);
  const [isCancelling, startCancelTransition] = useTransition();
  const hasRunning = useMemo(() => runs.some((run) => run.status === "running"), [runs]);

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
      await cancelExternalSyncRunAction(runId);
      await refreshRuns();
    });
  }

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      try {
        const nextRuns = await getExternalSyncRunsAction() as Run[];
        if (mounted) setRuns(nextRuns);
      } catch {
        // păstrăm ultima stare afișată
      }
    }
    const interval = setInterval(refresh, hasRunning ? 2500 : 8000);
    return () => { mounted = false; clearInterval(interval); };
  }, [hasRunning]);

  return (
    <>
      <div className="grid external-source-grid">
        <SyncCard />
      </div>

      <section className="card compact-card" style={{ marginTop: 16 }}>
        <div className="section-header-row">
          <h2>Ultimele sincronizări</h2>
          <span className="muted small">Afișăm ultimele 2 rulări. {isCancelling ? "Se anulează..." : ""}</span>
        </div>
        <div className="list compact-list">
          {runs.slice(0, 2).map((run) => <RunRow key={run.id} run={run} onCancel={cancelRun} />)}
          {runs.length === 0 ? <p className="muted">Nu există sincronizări încă.</p> : null}
        </div>
      </section>
    </>
  );
}
