export const DEFAULT_FREESHOW_URL = "http://127.0.0.1:5510/freeshow";
export const FREESHOW_CONNECTOR_EXE_URL = "https://github.com/onn-gede/song.app/releases/download/connector-latest/SongApp-FreeShow-Connector-Setup.exe";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function normalizeFreeShowLocalUrl(value: string) {
  const raw = value.trim() || DEFAULT_FREESHOW_URL;
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error("Adresa FreeShow nu este validă."); }
  if (url.protocol !== "http:") throw new Error("Conectorul local trebuie să folosească adresa http://.");
  if (!LOCAL_HOSTS.has(url.hostname)) throw new Error("Pentru siguranță este permis numai conectorul de pe acest calculator.");
  if (url.username || url.password || url.search || url.hash) throw new Error("Adresa FreeShow nu poate conține utilizator, parolă sau parametri.");
  const port = url.port ? Number(url.port) : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Portul FreeShow nu este valid.");
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString().replace(/\/$/, "");
}

export function freeShowConnectorHealthUrl(value: string) {
  const endpoint = normalizeFreeShowLocalUrl(value);
  const url = new URL(endpoint);
  url.pathname = url.pathname.replace(/\/freeshow\/?$/, "/health");
  if (!url.pathname.endsWith("/health")) url.pathname = "/health";
  return url.toString().replace(/\/$/, "");
}

export function freeShowResponseData(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const row = value as Record<string, unknown>;
  return row.data ?? row.result ?? value;
}

export type FreeShowShowSummary = {id:string;name:string;origin?:string};
export type FreeShowProjectSummary = {id:string;name:string;shows?:unknown[]};

export function buildFreeShowCreateData(name: string, text: string, open = true, origin?: string) {
  return { name, text, category: "SongApp", open, ...(origin ? { origin } : {}) } as const;
}

export function freeShowRows(value: unknown): FreeShowShowSummary[] {
  const data = freeShowResponseData(value);
  const rows: FreeShowShowSummary[] = [];
  if (Array.isArray(data)) {
    for (const item of data) if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      if (typeof row.id === "string" && typeof row.name === "string") rows.push({id:row.id,name:row.name,...(typeof row.origin === "string"?{origin:row.origin}:{})});
    }
  } else if (data && typeof data === "object") {
    for (const [id,item] of Object.entries(data as Record<string, unknown>)) if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      if (typeof row.name === "string") rows.push({id:typeof row.id === "string"?row.id:id,name:row.name,...(typeof row.origin === "string"?{origin:row.origin}:{})});
    }
  }
  return rows;
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("ro-RO");
}

export function findFreeShowMatches(value: unknown, name: string, sourceKey?: string): FreeShowShowSummary[] {
  const rows = freeShowRows(value);
  const bySource = sourceKey ? rows.filter((row) => row.origin === sourceKey) : [];
  const byName = rows.filter((row) => normalized(row.name) === normalized(name));
  return [...bySource, ...byName].filter((row, index, all) => all.findIndex((candidate) => candidate.id === row.id) === index);
}

export function findFreeShowByName(value: unknown, name: string): FreeShowShowSummary|null {
  return findFreeShowMatches(value, name)[0] || null;
}

export function createdFreeShowId(value: unknown) {
  const data = freeShowResponseData(value);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.id === "string" && row.id) return row.id;
  const show = row.show;
  if (show && typeof show === "object" && typeof (show as Record<string, unknown>).id === "string") return (show as Record<string, unknown>).id as string;
  return null;
}

export function freeShowProjects(value: unknown): FreeShowProjectSummary[] {
  const data = freeShowResponseData(value);
  const projects: FreeShowProjectSummary[] = [];
  if (Array.isArray(data)) {
    for (const item of data) if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      if (typeof row.id === "string" && typeof row.name === "string") projects.push({id:row.id,name:row.name,shows:Array.isArray(row.shows)?row.shows:undefined});
    }
  } else if (data && typeof data === "object") {
    for (const [id,item] of Object.entries(data as Record<string, unknown>)) if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      if (typeof row.name === "string") projects.push({id:typeof row.id === "string"?row.id:id,name:row.name,shows:Array.isArray(row.shows)?row.shows:undefined});
    }
  }
  return projects;
}

export function findFreeShowProject(value: unknown, id: string, name: string): FreeShowProjectSummary|null {
  const rows = freeShowProjects(value);
  return rows.find((row) => row.id === id) || rows.find((row) => normalized(row.name) === normalized(name)) || null;
}

export function freeShowProjectItemCount(value: unknown) {
  const data = freeShowResponseData(value);
  if (!data || typeof data !== "object" || Array.isArray(data)) return 0;
  const shows = (data as Record<string, unknown>).shows;
  return Array.isArray(shows) ? shows.length : 0;
}
