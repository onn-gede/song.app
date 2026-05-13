"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SourceSlug = "melodia" | "resursecrestine";

type ParsedExternalSong = {
  externalId: string;
  url: string;
  title: string;
  lyrics: string;
  sections: Array<{ section_type: string; section_label: string | null; content: string }>;
};

type SyncOptions = {
  sourceSlug: SourceSlug;
  pages: number;
  maxSongs: number;
  overwrite: boolean;
};

function readString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function absoluteUrl(base: string, href: string) {
  return new URL(href, base).toString();
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function decodeHtml(input: string) {
  return decodeHtmlEntities(input)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|h\d|li|section|article|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSpaces(text: string) {
  return text
    .replace(/\uFEFF/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\u00ad/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isChordOnlyLine(line: string) {
  const chord = String.raw`[A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add)?\d*(?:\/[A-G](?:#|b)?)?`;
  return new RegExp(`^(?:${chord}|N\\.C\\.|-|–)(?:\\s+${chord}){0,8}$`, "i").test(line.trim());
}

function isNoiseLine(line: string) {
  const value = line.trim();
  if (!value) return true;
  if (isChordOnlyLine(value)) return true;
  return /^(Versuri|Acorduri|Slideshow|Fullscreen|Print|Export|Cuvinte Cheie|Cântări Similare|Demo|Variante ale cântării|Acțiuni Cântare|Salvează|Prezintă|Loading\.\.\.|Creează cont|Organizezi muzica în biserică\?)$/i.test(value);
}

function normalizeLyricsText(text: string) {
  const lines = normalizeSpaces(decodeHtml(text))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !isNoiseLine(line));
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function sectionLabelFromMarker(marker: string, fallbackIndex: number) {
  const m = marker.trim().replace(/:$/, "");
  if (/^(refren|cor|r)$/i.test(m)) return "Refren";
  if (/^r\s*\d+$/i.test(m)) return `Refren ${m.replace(/\D/g, "")}`;
  const numberMatch = m.match(/^(?:strofă|strofa|s)?\s*(\d+)/i);
  if (/^(strofă|strofa|s|\d)/i.test(m) && numberMatch) return `Strofa ${numberMatch[1]}`;
  return `Strofa ${fallbackIndex}`;
}

function splitSections(lyrics: string) {
  const cleaned = normalizeLyricsText(lyrics);
  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sections: Array<{ section_type: string; section_label: string | null; content: string }> = [];
  let current: { marker: string; type: string; lines: string[] } | null = null;

  const push = () => {
    if (!current) return;
    const content = current.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!content) return;
    sections.push({
      section_type: current.type,
      section_label: sectionLabelFromMarker(current.marker, sections.length + 1),
      content
    });
  };

  for (const line of lines) {
    const markerMatch = line.match(/^(?:(Strofă|Strofa)\s*(\d+)?|S\s*(\d+)|Refren\s*(\d+)?|Cor|R\s*(\d+)?|C:)\s*[:.-]?\s*(.*)$/i)
      || line.match(/^(\d+)\s*[.)]\s*(.*)$/)
      || line.match(/^R\s*:\s*(.*)$/i);

    if (markerMatch) {
      const rawMarker = markerMatch[1] && /^\d+$/.test(markerMatch[1])
        ? markerMatch[1]
        : line.replace(/\s*[:.-]?\s*(.*)$/i, "").trim();
      const markerText = markerMatch[0].replace((markerMatch.at(-1) || ""), "").trim();
      const marker = markerText || rawMarker || `Strofa ${sections.length + 1}`;
      const type = /^(refren|cor|r|c:)/i.test(marker) ? "chorus" : "verse";
      const rest = (markerMatch.at(-1) || "").trim();
      push();
      current = { marker, type, lines: [] };
      if (rest && !isNoiseLine(rest)) current.lines.push(rest);
      continue;
    }

    if (!current) current = { marker: `Strofa ${sections.length + 1}`, type: "verse", lines: [] };
    current.lines.push(line);
  }
  push();

  if (sections.length) return dedupeSections(sections);

  const blocks = cleaned.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return dedupeSections(blocks.map((block, index) => ({
    section_type: /^(refren|cor|r:)/i.test(block) ? "chorus" : "verse",
    section_label: /^(refren|cor|r:)/i.test(block) ? "Refren" : `Strofa ${index + 1}`,
    content: block.replace(/^(strofă|strofa|refren|cor|r:|c:|\d+[.)])\s*\d*\s*/i, "").trim()
  })));
}

function dedupeSections(sections: Array<{ section_type: string; section_label: string | null; content: string }>) {
  const seen = new Set<string>();
  const output: Array<{ section_type: string; section_label: string | null; content: string }> = [];
  for (const section of sections) {
    const key = `${section.section_type}|${normalizeSpaces(section.content).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(section);
  }
  return output;
}

function lyricsFromSections(sections: ParsedExternalSong["sections"]) {
  return sections.map((section) => `${section.section_label || (section.section_type === "chorus" ? "Refren" : "Strofa")}\n${section.content}`).join("\n\n").trim();
}


function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function firstStopIndex(text: string, start: number, tokens: string[]) {
  const haystack = stripDiacritics(text);
  const positions = tokens
    .map((token) => haystack.indexOf(stripDiacritics(token), Math.max(0, start)))
    .filter((index) => index > start);
  return positions.length ? Math.min(...positions) : -1;
}

const RESURSE_STOP_TOKENS = [
  "Resurse înrudite",
  "Resurse inrudite",
  "Cântări asemănătoare",
  "Cantari asemanatoare",
  "Comentarii",
  "Raportează o problemă",
  "Raporteaza o problema",
  "Statistici",
  "Opțiuni",
  "Optiuni",
  "De același autor",
  "De acelasi autor",
  "Confirmata",
  "Confirmată",
  "Adaugă la favorite",
  "Adauga la favorite"
];

async function isRunCancelled(runId?: string) {
  if (!runId) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("external_sync_runs").select("status").eq("id", runId).maybeSingle();
  return data?.status === "cancelled";
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36 SongAppSync/1.1",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ro-RO,ro;q=0.9,en-US;q=0.7,en;q=0.6"
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Nu am putut citi ${url} (${response.status}).`);
  return response.text();
}

function extractLinks(html: string, baseUrl: string, sourceSlug: SourceSlug) {
  const links: Array<{ url: string; title: string; externalId: string }> = [];
  const seen = new Set<string>();
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const href = match[1];
    let title = decodeHtml(match[2]).replace(/\s+/g, " ").trim();
    if (!title || title.length < 2) continue;
    const url = absoluteUrl(baseUrl, href).replace(/#.*$/, "");
    const isMelodia = sourceSlug === "melodia" && /melodia\.ro\/(songs|cantari)\/[a-z0-9-]+/i.test(url);
    const isResurse = sourceSlug === "resursecrestine" && /resursecrestine\.ro\/cantece\/\d+\//i.test(url);
    if (!isMelodia && !isResurse) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    // Pe listele Melodia titlul vine cu tonalitate/autor/preview. Titlul real îl citim din pagina cântecului.
    if (sourceSlug === "melodia") title = title.replace(/\s+(CE|H|CDE|OD)\s+#\d+.*$/i, "").trim();
    links.push({ url, title, externalId: url.replace(/^https?:\/\/(www\.)?/, "") });
  }
  return links;
}

function titleFromMelodia(html: string) {
  const decoded = decodeHtml(html);
  const hashTitle = decoded.match(/(?:^|\n)#\s*([^\n]+)/)?.[1]?.trim();
  if (hashTitle) return hashTitle.replace(/\s+[A-G](#|b)?m?$/i, "").trim();
  const h1 = decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "").trim();
  if (h1) return h1.replace(/\s+[A-G](#|b)?m?$/i, "").trim();
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").split("|")[0].trim();
}

function parseMelodiaSong(html: string, url: string): ParsedExternalSong | null {
  const title = titleFromMelodia(html);
  if (!title) return null;

  const text = decodeHtml(html);
  const startCandidates = [
    text.indexOf("Versuri Versuri Acorduri"),
    text.indexOf("Versuri Acorduri"),
    text.search(/\n(?:Strofă|Strofa|Refren|\d+[.)])\b/i)
  ].filter((i) => i >= 0);
  const start = startCandidates.length ? Math.min(...startCandidates) : -1;
  if (start < 0) return null;

  const endCandidates = [
    "Compusă în",
    "Cântată în",
    "Acțiuni Cântare",
    "Cântări Similare",
    "Versete",
    "Cuvinte Cheie",
    "Variante ale cântării",
    "Demo",
    "Povestea din Spate"
  ].map((token) => text.indexOf(token, start + 1)).filter((i) => i > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : text.length;
  let lyrics = normalizeLyricsText(text.slice(start, end))
    .replace(/^Versuri(\s+Versuri)?(\s+Acorduri)?/i, "")
    .replace(/^(Muzica de|Versuri de|Text de|Autor).+$/gim, "")
    .replace(/Modulație\s*[A-G](#|b)?m?/gi, "")
    .replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "gim"), "")
    .trim();

  // Unele pagini conțin și varianta cu acorduri după textul simplu. Păstrăm prima zonă consistentă.
  const repeatedStart = lyrics.search(/\n(?:E|C|D|G|A|F|Bb|Eb)\s+(?:C|D|G|A|F|Bb|Eb)/);
  if (repeatedStart > 200) lyrics = lyrics.slice(0, repeatedStart).trim();

  const sections = splitSections(lyrics);
  const finalLyrics = sections.length ? lyricsFromSections(sections) : lyrics;
  if (!finalLyrics || finalLyrics.length < 20) return null;
  return { externalId: url.replace(/^https?:\/\/(www\.)?/, ""), url, title, lyrics: finalLyrics, sections };
}

function titleFromResurse(html: string) {
  const textTitle = decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    || "").replace(/ - Resurse Creștine.*/i, "").trim();
  return textTitle;
}

function parseResurseSong(html: string, url: string): ParsedExternalSong | null {
  const title = titleFromResurse(html);
  if (!title) return null;

  const text = decodeHtml(html);
  const compactMarker = text.search(/\n\s*\d+\s*\/\s*\d+\s*▲\s*\n/i);
  let slice = "";
  if (compactMarker >= 0) {
    const compactStart = text.indexOf("\n", compactMarker + 1);
    const end = firstStopIndex(text, compactMarker, RESURSE_STOP_TOKENS);
    const safeEnd = end > compactMarker ? end : text.length;
    slice = text.slice(compactStart, safeEnd);
  } else {
    const startCandidates = [text.indexOf("Strofă 1"), text.indexOf("Strofa 1"), text.search(/\n1\.\s+/)].filter((i) => i >= 0);
    const start = startCandidates.length ? Math.min(...startCandidates) : -1;
    if (start < 0) return null;
    const end = firstStopIndex(text, start, RESURSE_STOP_TOKENS);
    slice = text.slice(start, end > start ? end : text.length);
  }

  let lyricsCandidate = normalizeLyricsText(slice)
    .replace(/\b\d+\s*\/\s*\d+\s*▲/g, "")
    .replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "gim"), "")
    .trim();
  const relatedIndex = firstStopIndex(lyricsCandidate, 0, RESURSE_STOP_TOKENS);
  if (relatedIndex > 0) lyricsCandidate = lyricsCandidate.slice(0, relatedIndex).trim();

  const sections = splitSections(lyricsCandidate);
  const finalLyrics = sections.length ? lyricsFromSections(sections) : lyricsCandidate;
  if (!finalLyrics || finalLyrics.length < 20) return null;
  return { externalId: url.replace(/^https?:\/\/(www\.)?/, ""), url, title, lyrics: finalLyrics, sections };
}

async function ensureSourceAndCollection(sourceSlug: SourceSlug) {
  const supabase = await createClient();
  const cfg = { collectionName: "Resurse Creștine", shortCode: "RESURSE_CRESTINE", sourceName: "Resurse Creștine", baseUrl: "https://www.resursecrestine.ro", license: "CC BY-NC-SA", url: "https://www.resursecrestine.ro/termeni-si-conditii", notes: "Sincronizare limitată la titlu și versuri." };

  let { data: collection } = await supabase.from("song_collections").select("id").eq("short_code", cfg.shortCode).maybeSingle();
  if (!collection) {
    const { data, error } = await supabase.from("song_collections").insert({ name: cfg.collectionName, short_code: cfg.shortCode, description: cfg.notes, source_type: "other", is_active: true }).select("id").single();
    if (error) throw new Error(error.message);
    collection = data;
  }

  let { data: source } = await supabase.from("external_sources").select("id").eq("slug", sourceSlug).maybeSingle();
  if (!source) {
    const { data, error } = await supabase.from("external_sources").insert({ name: cfg.sourceName, slug: sourceSlug, base_url: cfg.baseUrl, collection_id: collection.id, sync_mode: "title_lyrics_only", license_label: cfg.license, license_url: cfg.url, permission_notes: cfg.notes, is_enabled: true }).select("id").single();
    if (error) throw new Error(error.message);
    source = data;
  }
  return { supabase, sourceId: source.id, collectionId: collection.id, baseUrl: cfg.baseUrl };
}

async function upsertParsedSong(args: { parsed: ParsedExternalSong; sourceId: string; collectionId: string; overwrite: boolean }) {
  const { parsed, sourceId, collectionId, overwrite } = args;
  const supabase = await createClient();
  const hash = crypto.createHash("sha256").update(parsed.title + "\n" + parsed.lyrics).digest("hex");
  const sections = parsed.sections.map((section, index) => ({
    section_type: section.section_type || "verse",
    section_label: section.section_label,
    position: index + 1,
    content: section.content
  }));

  const { data, error } = await supabase.rpc("upsert_external_song_title_lyrics", {
    p_external_source_id: sourceId,
    p_collection_id: collectionId,
    p_external_id: parsed.externalId,
    p_external_url: parsed.url,
    p_title: parsed.title,
    p_lyrics_text: parsed.lyrics,
    p_sections: sections,
    p_content_hash: hash,
    p_overwrite: overwrite
  });

  if (error) throw new Error(error.message);
  const result = String(data || "imported");
  if (result === "updated" || result === "skipped" || result === "imported") return result as "updated" | "skipped" | "imported";
  return "imported" as const;
}

async function updateRun(runId: string | undefined, data: Record<string, any>) {
  if (!runId) return;
  const supabase = await createClient();
  await supabase.from("external_sync_runs").update(data).eq("id", runId);
}

async function processExternalSyncRun(options: SyncOptions, runId?: string) {
  const { sourceSlug, pages, maxSongs, overwrite } = options;
  const { supabase, sourceId, collectionId, baseUrl } = await ensureSourceAndCollection(sourceSlug);

  let found = 0;
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const links: Array<{ url: string; title: string; externalId: string }> = [];
    for (let page = 1; page <= pages; page += 1) {
      if (await isRunCancelled(runId)) {
        await updateRun(runId, { status: "cancelled", finished_at: new Date().toISOString() });
        return;
      }
      const listUrl = `${baseUrl}/cantece/index-ultimele${page > 1 ? `/${page}` : ""}`;
      const html = await fetchHtml(listUrl);
      links.push(...extractLinks(html, baseUrl, sourceSlug));
      await updateRun(runId, { pages_scanned: page, found_count: links.length });
    }

    const uniqueLinks = Array.from(new Map(links.map((link) => [link.url, link])).values()).slice(0, maxSongs);
    found = uniqueLinks.length;
    await updateRun(runId, { found_count: found });

    for (const link of uniqueLinks) {
      try {
        const html = await fetchHtml(link.url);
        if (await isRunCancelled(runId)) {
          await updateRun(runId, { status: "cancelled", found_count: found, imported_count: imported, updated_count: updated, skipped_count: skipped, finished_at: new Date().toISOString() });
          return;
        }
        const parsed = parseResurseSong(html, link.url);
        if (!parsed) {
          skipped += 1;
        } else {
          const result = await upsertParsedSong({ parsed, sourceId, collectionId, overwrite });
          if (result === "imported") imported += 1;
          else if (result === "updated") updated += 1;
          else skipped += 1;
        }
      } catch {
        skipped += 1;
      }
      await updateRun(runId, { imported_count: imported, updated_count: updated, skipped_count: skipped });
    }

    if (await isRunCancelled(runId)) {
      await updateRun(runId, { status: "cancelled", found_count: found, imported_count: imported, updated_count: updated, skipped_count: skipped, finished_at: new Date().toISOString() });
      return;
    }
    await supabase.from("external_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", sourceId);
    await updateRun(runId, { status: "finished", pages_scanned: pages, found_count: found, imported_count: imported, updated_count: updated, skipped_count: skipped, finished_at: new Date().toISOString(), error_message: null });
  } catch (error: any) {
    await updateRun(runId, { status: "failed", pages_scanned: pages, found_count: found, imported_count: imported, updated_count: updated, skipped_count: skipped, error_message: error?.message || String(error), finished_at: new Date().toISOString() });
  }

  revalidatePath("/external-sources");
  revalidatePath("/collections");
  revalidatePath("/songs");
  revalidatePath("/dashboard");
}

function readSyncOptions(formData: FormData): SyncOptions {
  const sourceSlug = readString(formData, "source") as SourceSlug;
  const pages = Math.max(1, Math.min(10, Number.parseInt(readString(formData, "pages") || "1", 10)));
  const maxSongs = Math.max(1, Math.min(200, Number.parseInt(readString(formData, "max_songs") || "25", 10)));
  const overwrite = readString(formData, "overwrite") === "on";
  if (sourceSlug !== "resursecrestine") throw new Error("Momentan este activă doar sincronizarea Resurse Creștine.");
  return { sourceSlug, pages, maxSongs, overwrite };
}

export async function startExternalSyncAction(formData: FormData) {
  const options = readSyncOptions(formData);
  const { supabase, sourceId } = await ensureSourceAndCollection(options.sourceSlug);
  const { data: run, error } = await supabase
    .from("external_sync_runs")
    .insert({ external_source_id: sourceId, status: "running", pages_scanned: 0, found_count: 0, imported_count: 0, updated_count: 0, skipped_count: 0 })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  setTimeout(() => {
    void processExternalSyncRun(options, run.id);
  }, 0);

  revalidatePath("/external-sources");
  return { runId: run.id as string };
}

export async function syncExternalSongsAction(formData: FormData) {
  // Compatibilitate cu formularul vechi: pornește sincronizarea și revine rapid.
  return startExternalSyncAction(formData);
}

export async function cancelExternalSyncRunAction(runId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("external_sync_runs")
    .update({ status: "cancelled", finished_at: new Date().toISOString(), error_message: "Anulată manual." })
    .eq("id", runId)
    .eq("status", "running");
  if (error) throw new Error(error.message);
  revalidatePath("/external-sources");
}

export async function getExternalSyncRunsAction() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("external_sync_runs")
    .select("id,status,pages_scanned,found_count,imported_count,updated_count,skipped_count,error_message,started_at,finished_at,external_sources!inner(name,slug)")
    .eq("external_sources.slug", "resursecrestine")
    .order("started_at", { ascending: false })
    .limit(2);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function deleteResurseExternalSongsAction(formData: FormData) {
  const confirmation = readString(formData, "confirmation");
  if (confirmation !== "STERGE RESURSE") {
    throw new Error("Pentru ștergere trebuie să scrii exact: STERGE RESURSE");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_external_source_songs", {
    p_source_slug: "resursecrestine"
  });
  if (error) throw new Error(error.message);
  revalidatePath("/external-sources");
  revalidatePath("/songs");
  revalidatePath("/dashboard");
  revalidatePath("/collections");
  return data;
}
