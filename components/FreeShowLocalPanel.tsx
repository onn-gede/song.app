"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildFreeShowCreateData,
  createdFreeShowId,
  DEFAULT_FREESHOW_URL,
  FREESHOW_CONNECTOR_EXE_URL,
  findFreeShowMatches,
  findFreeShowProject,
  freeShowProjectItemCount,
  freeShowResponseData,
  freeShowRows,
  normalizeFreeShowLocalUrl,
  type FreeShowShowSummary,
} from "@/lib/freeshow-local";

type Status = { kind: "idle" | "working" | "success" | "error"; message: string };
type ProgramItem = {
  id: string;
  kind: "song" | "moment";
  name: string;
  library_name: string;
  source_key: string;
  text: string;
  slide_count: number;
};
type ProgramPayload = {
  name: string;
  project_id: string;
  project_name: string;
  meeting_date_label: string;
  items: ProgramItem[];
  item_count: number;
  slide_count: number;
};

const STORAGE_URL = "songapp:freeshow-url";
const STORAGE_KEY = "songapp:freeshow-auth";

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function freeShowCall(endpoint: string, auth: string, action: string, data: Record<string, unknown> = {}, expectResult = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), expectResult ? 15_000 : 8_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify({ action, ...data, ...(expectResult ? { returnId: crypto.randomUUID() } : {}) }),
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    const text = await response.text();
    let parsed: unknown = null;
    if (text) try { parsed = JSON.parse(text); } catch { parsed = text; }
    if (!response.ok) throw new Error(response.status === 401 ? "Cheia API FreeShow este greșită." : `FreeShow a răspuns cu eroarea ${response.status}.`);
    return freeShowResponseData(parsed);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("FreeShow nu a răspuns la timp.");
    if (error instanceof TypeError) throw new Error("Conectorul local nu răspunde. Pornește conectorul FreeShow, apoi încearcă din nou.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForProject(endpoint: string, auth: string, projectId: string, expectedCount?: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const project = await freeShowCall(endpoint, auth, "get_project", { id: projectId }, true);
    if (project && (expectedCount === undefined || freeShowProjectItemCount(project) === expectedCount)) return project;
    await wait(100);
  }
  throw new Error("FreeShow nu a confirmat actualizarea proiectului.");
}

export function FreeShowLocalPanel({ meetingId }: { meetingId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(DEFAULT_FREESHOW_URL);
  const [auth, setAuth] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle", message: "Configurația se păstrează numai în acest browser." });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_URL) || "";
      setUrl(/:(?:5505|5506)\/?$/.test(saved) ? DEFAULT_FREESHOW_URL : saved || DEFAULT_FREESHOW_URL);
      setAuth(localStorage.getItem(STORAGE_KEY) || "");
    } catch {}
  }, []);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, [open]);

  function close() { setOpen(false); }
  function settings() {
    const endpoint = normalizeFreeShowLocalUrl(url);
    try {
      localStorage.setItem(STORAGE_URL, endpoint);
      localStorage.setItem(STORAGE_KEY, auth);
    } catch {}
    setUrl(endpoint);
    return endpoint;
  }

  async function test() {
    setStatus({ kind: "working", message: "Verific legătura cu FreeShow…" });
    try {
      const endpoint = settings();
      const result = await freeShowCall(endpoint, auth, "get_shows", {}, true);
      if (!result || typeof result !== "object") throw new Error("FreeShow este conectat, dar nu a trimis inventarul prezentărilor. Actualizează FreeShow la versiunea curentă.");
      setStatus({ kind: "success", message: `FreeShow este conectat · ${freeShowRows(result).length} prezentări disponibile.` });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Conexiunea FreeShow a eșuat." });
    }
  }

  async function send() {
    setStatus({ kind: "working", message: "Citesc biblioteca FreeShow și pregătesc programul…" });
    try {
      const endpoint = settings();
      const response = await fetch(`/api/meetings/${meetingId}/freeshow?format=api`, { cache: "no-store" });
      const payload = await response.json() as ProgramPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Programul nu a putut fi pregătit.");

      let inventory = await freeShowCall(endpoint, auth, "get_shows", {}, true);
      if (!inventory || typeof inventory !== "object") throw new Error("FreeShow nu a trimis lista cântărilor. Actualizează FreeShow înainte de sincronizare, ca să evităm duplicatele.");

      const projectItems: Array<{ id: string; name: string }> = [];
      const projectIds = new Set<string>();
      let created = 0;
      let updated = 0;
      let reused = 0;
      let oldDuplicates = 0;

      for (let index = 0; index < payload.items.length; index += 1) {
        const item = payload.items[index];
        setStatus({ kind: "working", message: `Sincronizez ${index + 1}/${payload.items.length}: ${item.name}` });
        let matches = findFreeShowMatches(inventory, item.library_name, item.source_key);
        oldDuplicates += Math.max(0, matches.length - 1);
        let show: FreeShowShowSummary | null = matches[0] || null;

        if (show) {
          if (show.origin === item.source_key) {
            await freeShowCall(endpoint, auth, "set_plain_text", { id: show.id, value: item.text });
            updated += 1;
          } else {
            reused += 1;
          }
        } else {
          const createdResult = await freeShowCall(endpoint, auth, "create_show", buildFreeShowCreateData(item.library_name, item.text, false, item.source_key), true);
          let showId = createdFreeShowId(createdResult);
          if (!showId) {
            inventory = await freeShowCall(endpoint, auth, "get_shows", {}, true);
            matches = findFreeShowMatches(inventory, item.library_name, item.source_key);
            showId = matches[0]?.id || null;
          }
          if (!showId) throw new Error(`FreeShow a primit „${item.name}”, dar nu a returnat ID-ul prezentării. Actualizează FreeShow și încearcă din nou.`);
          show = { id: showId, name: item.library_name, origin: item.source_key };
          created += 1;
          inventory = [...freeShowRows(inventory), show];
        }

        if (!projectIds.has(show.id)) {
          projectIds.add(show.id);
          projectItems.push({ id: show.id, name: item.name });
        }
      }

      const projects = await freeShowCall(endpoint, auth, "get_projects", {}, true);
      if (!projects || typeof projects !== "object") throw new Error("FreeShow nu a trimis lista proiectelor.");
      const existingProject = findFreeShowProject(projects, payload.project_id, payload.project_name);
      const projectId = existingProject?.id || payload.project_id;

      if (!existingProject) {
        setStatus({ kind: "working", message: `Creez proiectul „${payload.project_name}”…` });
        await freeShowCall(endpoint, auth, "create_project", { id: projectId, name: payload.project_name });
        await wait(200);
        await waitForProject(endpoint, auth, projectId, 0);
      } else {
        await freeShowCall(endpoint, auth, "rename_project", { id: projectId, name: payload.project_name });
        let project = await freeShowCall(endpoint, auth, "get_project", { id: projectId }, true);
        for (let count = freeShowProjectItemCount(project); count > 0; count -= 1) {
          setStatus({ kind: "working", message: `Actualizez proiectul FreeShow · elimin elementul vechi ${count}…` });
          await freeShowCall(endpoint, auth, "remove_project_item", { id: projectId, index: count });
          await wait(100);
          project = await waitForProject(endpoint, auth, projectId, count - 1);
        }
      }

      for (let index = 0; index < projectItems.length; index += 1) {
        const item = projectItems[index];
        setStatus({ kind: "working", message: `Construiesc programul FreeShow ${index + 1}/${projectItems.length}: ${item.name}` });
        await freeShowCall(endpoint, auth, "add_to_project", { projectId, id: item.id, data: { name: item.name, type: "show" } }, true);
      }

      await freeShowCall(endpoint, auth, "id_select_project", { id: projectId });
      if (projectItems.length) await freeShowCall(endpoint, auth, "index_select_project_item", { index: 1 });

      const duplicateNotice = oldDuplicates ? ` · ${oldDuplicates} duplicate vechi detectate (nu au fost șterse)` : "";
      setStatus({ kind: "success", message: `Proiect pregătit: ${payload.project_name} · ${projectItems.length} elemente · ${created} create · ${updated} actualizate · ${reused} reutilizate${duplicateNotice}.` });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Programul nu a putut fi trimis." });
    }
  }

  async function command(action: string, success: string) {
    setStatus({ kind: "working", message: "Trimit comanda…" });
    try {
      await freeShowCall(settings(), auth, action);
      setStatus({ kind: "success", message: success });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Comanda FreeShow a eșuat." });
    }
  }

  return <>
    <button type="button" className="btn secondary" onClick={() => setOpen(true)}>FreeShow local</button>
    {open ? <dialog ref={dialog} className="freeshow-local-dialog" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === dialog.current) close(); }}>
      <header><div><div className="eyebrow">Conexiune pe acest PC</div><h2>FreeShow local</h2><p className="muted small">Sincronizează biblioteca fără duplicate și pregătește automat proiectul acestei întâlniri.</p></div><button type="button" className="icon-btn" onClick={close} aria-label="Închide">×</button></header>
      <div className="form-grid">
        <label className="label">Adresă conector SongApp<input className="input" value={url} onChange={(event) => setUrl(event.target.value)} inputMode="url" autoCapitalize="none" spellCheck={false}/><small>Adresa recomandată este {DEFAULT_FREESHOW_URL}. FreeShow folosește intern portul REST 5506.</small></label>
        <label className="label">Cheie API FreeShow (opțional)<input className="input" type="password" value={auth} onChange={(event) => setAuth(event.target.value)} autoComplete="off"/><small>Las-o goală dacă nu ai configurat una. Valoarea rămâne numai în acest browser.</small></label>
        <div className="inline-form"><a className="btn secondary btn-compact" href={FREESHOW_CONNECTOR_EXE_URL}>Descarcă instalatorul Windows (.exe)</a><a className="quiet-button" href="/downloads/SongApp-FreeShow-Connector-Setup-Windows.zip" download>Variantă de rezervă ZIP</a></div>
        <div className="inline-form"><button type="button" className="btn secondary" disabled={status.kind === "working"} onClick={test}>Testează conexiunea</button><button type="button" className="btn" disabled={status.kind === "working"} onClick={send}>Sincronizează și creează programul</button></div>
        <p className={`freeshow-local-status ${status.kind}`} role="status">{status.message}</p>
        <details className="freeshow-local-controls"><summary>Control rapid al prezentării</summary><div className="inline-form"><button type="button" className="btn secondary btn-compact" onClick={() => command("previous_slide", "Slide anterior afișat.")}>← Anterior</button><button type="button" className="btn secondary btn-compact" onClick={() => command("next_slide", "Slide următor afișat.")}>Următor →</button><button type="button" className="btn secondary btn-compact" onClick={() => command("clear_all", "Ecranul FreeShow a fost golit.")}>Ecran gol</button></div></details>
      </div>
    </dialog> : null}
  </>;
}
