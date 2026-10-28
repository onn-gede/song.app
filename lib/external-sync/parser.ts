export type SourceSlug = "melodia" | "resursecrestine";

export type ParsedExternalSong = {
  externalId: string;
  url: string;
  title: string;
  lyrics: string;
  sections: Array<{ section_type: string; section_label: string | null; content: string }>;
};

export type SyncOptions = {
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

async function fetchHtml(url: string) {
  assertSourceUrl(url);
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36 SongAppSync/1.1",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ro-RO,ro;q=0.9,en-US;q=0.7,en;q=0.6"
    },
    signal: AbortSignal.timeout(20000),
    redirect: "error",
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
    let url: string;
    try {
      url = absoluteUrl(baseUrl, href).replace(/#.*$/, "");
      assertSourceUrl(url);
    } catch { continue; }
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


export { fetchHtml, extractLinks, parseResurseSong };

export function assertSourceUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["www.resursecrestine.ro", "resursecrestine.ro"].includes(url.hostname) || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Adresa sursei externe nu este permisă.");
  }
}
