"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  confirmSongFilesImportBatchAction,
  previewSongFilesImportAction,
  type ConfirmImportBatchError,
  type ImportPreviewItem,
  type ImportPreviewResult
} from "@/app/(app)/import/actions";

type Collection = {
  id: string;
  name: string;
  short_code: string;
  source_type?: string | null;
};

type Props = {
  collections: Collection[];
};

type ImportProgress = {
  active: boolean;
  processed: number;
  total: number;
  created: number;
  skipped: number;
  startedAt: number;
  currentLabel?: string;
  errors: ConfirmImportBatchError[];
};

function useDelayedLoading(isLoading: boolean, delayMs = 2000) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShow(false);
      return;
    }

    const timeout = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(timeout);
  }, [isLoading, delayMs]);

  return show;
}

function useElapsedSeconds(active: boolean) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [active]);

  return seconds;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "calculez…";
  if (seconds < 1) return "sub 1 sec.";
  if (seconds < 60) return `${Math.ceil(seconds)} sec.`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.ceil(seconds % 60);
  return rest > 0 ? `${minutes} min ${rest} sec.` : `${minutes} min`;
}

function estimateRemainingSeconds(progress: ImportProgress) {
  if (!progress.processed) return null;
  const elapsed = (Date.now() - progress.startedAt) / 1000;
  const perItem = elapsed / progress.processed;
  return Math.max(0, Math.round(perItem * (progress.total - progress.processed)));
}

function ImportLoadingOverlay({
  title,
  description,
  progress,
  elapsedSeconds
}: {
  title: string;
  description: string;
  progress?: ImportProgress | null;
  elapsedSeconds?: number;
}) {
  const percent = progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  const remaining = progress ? estimateRemainingSeconds(progress) : null;

  return (
    <div className="loader-overlay" role="status" aria-live="polite" aria-label={title}>
      <div className="loader-card loader-card-wide">
        <div className="loader-spinner" aria-hidden="true" />
        <div className="loader-content">
          <strong>{title}</strong>
          <p className="muted small">{description}</p>

          {progress ? (
            <div className="import-progress-box">
              <div className="import-progress-meta small">
                <span>{progress.processed} din {progress.total} procesate</span>
                <span>{percent}%</span>
              </div>
              <div className="import-progress-track" aria-hidden="true">
                <div className="import-progress-fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="import-progress-meta small muted">
                <span>Importate: {progress.created}</span>
                <span>Sărite/erori: {progress.skipped}</span>
              </div>
              <p className="muted small">Timp rămas estimat: {formatDuration(remaining)}</p>
              {progress.currentLabel ? <p className="muted small">Ultimul lot: {progress.currentLabel}</p> : null}
              {progress.errors.length > 0 ? <p className="error small">{progress.errors.length} fișiere au fost sărite. Le vei vedea după finalizare.</p> : null}
            </div>
          ) : elapsedSeconds ? (
            <p className="muted small">Timp scurs: {formatDuration(elapsedSeconds)}. Pentru arhive mari, progresul exact apare după ce analiza inițială termină lista cântărilor.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CollectionFields({ collections }: Props) {
  return (
    <div className="form-two">
      <label className="label">Colecție existentă
        <select className="select" name="collection_id" defaultValue="">
          <option value="">Alege colecția...</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>{collection.name} ({collection.short_code})</option>
          ))}
        </select>
      </label>
      <label className="label">Sau colecție nouă
        <input className="input" name="new_collection_name" placeholder="ex: Colinde 2026" />
      </label>
    </div>
  );
}

function SongMetadataFields() {
  return (
    <div className="form-three">
      <label className="label">Tonalitate
        <input className="input" name="default_key" placeholder="ex: D, G, Em" />
      </label>
      <label className="label">BPM
        <input className="input" type="number" name="bpm" min="30" max="260" placeholder="ex: 72" />
      </label>
      <label className="label">Structură
        <input className="input" name="structure" placeholder="ex: V1, R, V2, R" />
      </label>
    </div>
  );
}

function defaultDecisionForItem(item: ImportPreviewItem) {
  if (!item.canImport) return "skip";
  return item.duplicates.length > 0 ? "skip" : "create";
}

export function ImportFilesWizard({ collections }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmFormRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<ConfirmImportBatchError[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const showPreviewLoader = useDelayedLoading(isPending);
  const showImportLoader = useDelayedLoading(isImporting);
  const previewElapsedSeconds = useElapsedSeconds(showPreviewLoader);

  function setAllDuplicateDecisions(value: "skip" | "overwrite" | "create") {
    if (!preview) return;
    const next: Record<string, string> = {};
    for (const item of preview.items) {
      if (!item.canImport) next[item.previewId] = "skip";
      else next[item.previewId] = item.duplicates.length > 0 ? value : "create";
    }
    setDecisions((current) => ({ ...current, ...next }));
  }

  async function handlePreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setImportErrors([]);
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const result = await previewSongFilesImportAction(formData);
        const initial: Record<string, string> = {};
        result.items.forEach((item) => {
          initial[item.previewId] = defaultDecisionForItem(item);
        });
        setDecisions(initial);
        setPreview(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nu am putut analiza importul.");
      }
    });
  }

  async function handleConfirmImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || isImporting) return;

    setError(null);
    setImportErrors([]);
    setIsImporting(true);

    const confirmFormData = new FormData(confirmFormRef.current || undefined);
    const targets: Record<string, string> = {};
    for (const item of preview.items) {
      const target = String(confirmFormData.get(`target_${item.previewId}`) || "").trim();
      if (target) targets[item.previewId] = target;
    }

    const startedAt = Date.now();
    const total = preview.items.length;
    const batchSize = 10;
    let processed = 0;
    let created = 0;
    let skipped = 0;
    const createdOrUpdatedIds: string[] = [];
    const allErrors: ConfirmImportBatchError[] = [];

    setImportProgress({
      active: true,
      processed,
      total,
      created,
      skipped,
      startedAt,
      errors: []
    });

    try {
      for (let start = 0; start < preview.items.length; start += batchSize) {
        const items = preview.items.slice(start, start + batchSize);
        const batchDecisions = Object.fromEntries(items.map((item) => [item.previewId, decisions[item.previewId] || defaultDecisionForItem(item)]));
        const batchTargets = Object.fromEntries(items.map((item) => [item.previewId, targets[item.previewId] || ""]));

        const result = await confirmSongFilesImportBatchAction({
          collectionId: preview.collectionId,
          metadata: preview.metadata,
          items,
          decisions: batchDecisions,
          targets: batchTargets
        });

        processed += result.processed;
        created += result.createdOrUpdatedIds.length;
        skipped += result.skipped;
        createdOrUpdatedIds.push(...result.createdOrUpdatedIds);
        allErrors.push(...result.errors);

        setImportProgress({
          active: true,
          processed,
          total,
          created,
          skipped,
          startedAt,
          currentLabel: items[items.length - 1]?.fileName,
          errors: [...allErrors]
        });
      }

      if (allErrors.length > 0) {
        setImportErrors(allErrors);
      }

      if (created === 0 && allErrors.length > 0) {
        setIsImporting(false);
        setImportProgress(null);
        return;
      }

      const errorQuery = allErrors.length > 0 ? `&errors=${allErrors.length}` : "";
      if (createdOrUpdatedIds.length === 1 && skipped === 0 && allErrors.length === 0) {
        window.location.assign(`/songs/${createdOrUpdatedIds[0]}/lyrics`);
        return;
      }
      window.location.assign(`/review?status=needs_review&imported=${created}&skipped=${skipped}${errorQuery}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut confirma importul.");
      setIsImporting(false);
      setImportProgress(null);
    }
  }

  return (
    <>
      {showPreviewLoader ? (
        <ImportLoadingOverlay
          title="Se analizează fișierele…"
          description="Citesc arhiva, extrag versurile și verific posibilele dubluri. Pentru ZIP-uri mari poate dura mai mult. Nu închide pagina."
          elapsedSeconds={previewElapsedSeconds}
        />
      ) : null}

      {showImportLoader ? (
        <ImportLoadingOverlay
          title="Se importă cântările…"
          description="Procesez loturi mici și salvez cântările. Progresul se actualizează după fiecare lot. Nu închide pagina."
          progress={importProgress}
        />
      ) : null}

      <form ref={formRef} onSubmit={handlePreview} className="form-grid file-import-form">
        <CollectionFields collections={collections} />

        <label className="label">Fișiere
          <input className="input file-input" name="files" type="file" accept=".txt,.md,.ppt,.pptx,.pdf,.zip,text/plain,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip" multiple required />
        </label>

        <div className="form-two">
          <label className="label">Titlu manual pentru un singur fișier, opțional
            <input className="input" name="title_override" placeholder="Lasă gol ca să fie preluat din numele fișierului" />
          </label>
          <label className="label">Număr manual pentru un singur fișier, opțional
            <input className="input" name="song_number_override" placeholder="ex: 352 sau 001b" />
          </label>
        </div>

        <SongMetadataFields />

        <label className="label">Note interne aplicate importului
          <textarea className="textarea" name="notes" placeholder="ex: import inițial, verificat parțial, carte sursă etc." />
        </label>

        {error ? <p className="error">{error}</p> : null}
        {importErrors.length > 0 ? (
          <div className="error">
            <strong>{importErrors.length} fișiere au fost sărite:</strong>
            <div className="import-error-list small">
              {importErrors.slice(0, 8).map((item) => (
                <div key={item.previewId}>• {item.fileName}: {item.message}</div>
              ))}
              {importErrors.length > 8 ? <div>… și încă {importErrors.length - 8}.</div> : null}
            </div>
          </div>
        ) : null}
        <button className="btn" type="submit" disabled={isPending || isImporting}>{isPending ? "Analizez fișierele…" : "Analizează fișierele și verifică dublurile"}</button>
      </form>

      {preview ? (
        <div className="dialog-backdrop" role="dialog" aria-modal="true">
          <div className="dialog dialog-wide import-wizard-dialog">
            <div className="top-row tight-row">
              <div>
                <div className="eyebrow">Import wizard</div>
                <h2>Confirmă importul</h2>
                <p className="muted small">
                  {preview.items.length} cântări analizate în colecția <strong>{preview.collectionName}</strong>. {preview.duplicateCount > 0 ? `${preview.duplicateCount} posibile dubluri găsite.` : "Nu am găsit dubluri evidente."}
                </p>
              </div>
              <button className="btn secondary btn-compact" type="button" onClick={() => setPreview(null)} disabled={isImporting}>Închide</button>
            </div>

            {preview.duplicateCount > 0 ? (
              <div className="inline-form import-wizard-actions">
                <button className="btn secondary btn-compact" type="button" onClick={() => setAllDuplicateDecisions("skip")} disabled={isImporting}>Nu suprascrie dublurile</button>
                <button className="btn secondary btn-compact" type="button" onClick={() => setAllDuplicateDecisions("overwrite")} disabled={isImporting}>Suprascrie toate dublurile</button>
                <button className="btn secondary btn-compact" type="button" onClick={() => setAllDuplicateDecisions("create")} disabled={isImporting}>Importă ca noi</button>
              </div>
            ) : null}

            <form ref={confirmFormRef} onSubmit={handleConfirmImport} className="form-grid">
              <div className="import-preview-list">
                {preview.items.map((item, index) => {
                  const decision = decisions[item.previewId] || defaultDecisionForItem(item);
                  return (
                    <div className={`import-preview-row ${item.duplicates.length > 0 ? "has-duplicates" : ""} ${!item.canImport ? "has-import-issues" : ""}`} key={item.previewId}>
                      <div className="import-preview-main">
                        <div className="row-title">{index + 1}. {item.title || item.fileName}</div>
                        <div className="badges compact-badges">
                          {item.songNumber ? <span className="badge">nr. {item.songNumber}</span> : null}
                          <span className="badge">{item.fileType.toUpperCase()}</span>
                          {!item.canImport ? <span className="badge warning">fără text</span> : item.duplicates.length > 0 ? <span className="badge warning">dublură posibilă</span> : <span className="badge">nouă</span>}
                        </div>
                        <p className="muted small">{item.fileName}</p>
                        {item.importIssues.length > 0 ? (
                          <div className="duplicate-box import-issue-box">
                            <strong>Problemă la import:</strong>
                            {item.importIssues.map((issue) => (
                              <div className="small" key={`${item.previewId}-${issue}`}>• {issue}</div>
                            ))}
                          </div>
                        ) : null}
                        {item.duplicates.length > 0 ? (
                          <div className="duplicate-box">
                            <strong>Potriviri existente:</strong>
                            {item.duplicates.map((duplicate) => (
                              <div className="small" key={`${item.previewId}-${duplicate.songId}`}>• {duplicate.title} {duplicate.songNumber ? `(nr. ${duplicate.songNumber})` : ""} — {duplicate.reason}</div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="import-preview-decision">
                        <label className="label">Acțiune
                          <select
                            className="select compact-select"
                            name={`decision_${item.previewId}`}
                            value={decision}
                            disabled={!item.canImport || isImporting}
                            onChange={(event) => setDecisions((current) => ({ ...current, [item.previewId]: event.target.value }))}
                          >
                            {!item.canImport ? <option value="skip">Sari peste</option> : null}
                            {item.canImport ? <option value="create">Importă ca nouă</option> : null}
                            {item.canImport ? <option value="skip">Sari peste</option> : null}
                            {item.canImport && item.duplicates.length > 0 ? <option value="overwrite">Suprascrie existentă</option> : null}
                          </select>
                        </label>
                        {item.duplicates.length > 0 ? (
                          <label className="label">Țintă suprascriere
                            <select className="select compact-select" name={`target_${item.previewId}`} defaultValue={item.duplicates[0]?.songId || ""} disabled={!item.canImport || decision !== "overwrite" || isImporting}>
                              {item.duplicates.map((duplicate) => (
                                <option key={duplicate.songId} value={duplicate.songId}>{duplicate.title}</option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="inline-form" style={{ justifyContent: "flex-end" }}>
                <button className="btn secondary" type="button" onClick={() => setPreview(null)} disabled={isImporting}>Anulează</button>
                <button className="btn" type="submit" disabled={isImporting}>{isImporting ? "Import în curs…" : "Confirmă importul"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
