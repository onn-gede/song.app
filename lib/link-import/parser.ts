import { createHash } from "node:crypto";
import { fetchPublicPage, validatePublicUrl, type PublicPage } from "./public-page";
import { load } from "cheerio";

export type LinkSection = { section_type: string; section_label: string; position: number; content: string };
export type LinkPreview = {
  url: string;
  sourceKey: string;
  title: string;
  lyricsText: string;
  sections: LinkSection[];
  author: string;
  album: string;
  topic: string;
  structure: string;
};
export function normalizeSongUrl(value: string) {
  const url = validatePublicUrl(value);
  url.hash = "";
  if (["www.resursecrestine.ro", "resursecrestine.ro"].includes(url.hostname)) {
    const match = url.pathname.match(/^\/cantece\/(\d+)\/([^/]+)\/?$/);
    if (url.protocol !== "https:" || !match)
      throw new Error("Folosește linkul direct al unei cântări Resurse Creștine.");
    return {
      url: `https://www.resursecrestine.ro/cantece/${match[1]}/${match[2]}`,
      sourceKey: `resursecrestine:${match[1]}`,
    };
  }
  if (url.hostname === "www.melodia.ro") url.hostname = "melodia.ro";
  for (const key of [...url.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return { url: url.href, sourceKey: `web:${createHash("sha256").update(url.href).digest("hex")}` };
}
function clean(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\t]/g, " ")
    .split("\n")
    .map((line) => line.trim().replace(/ {2,}/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SECTION_WORD =
  "Strofa|Strofă|Verse|Vers|Couplet|S|V|Pre[- ]?(?:refren|chorus)|Prechorus|Refren|Refrain|Chorus|Bridge|Punte|Final|Ending|Outro|Coda|Tag|Intro|Interlude|Instrumental|R|B";
const SECTION_MARKER = new RegExp(
  `^(?:\\[?\\s*)?(?:(?:\\d+)[.)]\\s*|(?:${SECTION_WORD})(?:\\s*\\d+)?\\s*[:.)-]?\\s*)(?:\\]\\s*)?$`,
  "i",
);

export function stripSectionMarkerLines(value: string) {
  const lines = clean(value).split("\n");
  while (lines.length && SECTION_MARKER.test(lines[0])) lines.shift();
  return clean(lines.join("\n"));
}

function lyricsFromSections(sections: LinkSection[]) {
  return sections
    .map((section) => stripSectionMarkerLines(section.content))
    .filter(Boolean)
    .join("\n\n");
}

export function sectionsWithEditedLyrics(original: LinkSection[], value: string) {
  const chunks = clean(value)
    .split(/\n\s*\n/g)
    .map(stripSectionMarkerLines)
    .filter(Boolean);
  if (chunks.length === original.length && chunks.length > 0) {
    return original.map((section, index) => ({ ...section, position: index + 1, content: chunks[index] }));
  }
  return sectionsFromLyrics(value).sections;
}

export function sectionsFromLyrics(value: string): { sections: LinkSection[]; structure: string } {
  const sections: LinkSection[] = [];
  let structure = "";
  let explicitType = false;
  let lines: string[] = [];
  let type = "verse",
    label = "Strofa 1",
    verse = 0;
  const push = () => {
    const content = stripSectionMarkerLines(lines.join("\n"));
    if (content)
      sections.push({ section_type: type, section_label: label, position: sections.length + 1, content });
    lines = [];
  };
  for (const line of clean(value).split("\n")) {
    if (/^I\s*:/i.test(line)) {
      structure = line.replace(/^I\s*:\s*/i, "");
      continue;
    }
    const bracketed = line.match(
      new RegExp(`^\\s*\\[\\s*(${SECTION_WORD})(?:\\s*(\\d+))?\\s*\\]\\s*(.*)$`, "i"),
    );
    const numbered = line.match(/^\s*(\d+)[.)]\s*(.*)$/);
    const labelled = line.match(
      new RegExp(`^\\s*(${SECTION_WORD})(?:\\s*(\\d+))?\\s*(?:[:.)-]\\s*|$)(.*)$`, "i"),
    );
    const marker = bracketed || numbered || labelled;
    if (marker) {
      if (!numbered || labelled || bracketed) explicitType = true;
      push();
      const numericOnly = !!numbered;
      const token = (numericOnly ? "verse" : marker[1] || "").toLowerCase();
      const number = numericOnly ? numbered?.[1] : marker[2];
      const remainder = numericOnly ? numbered?.[2] : marker[3];
      type = /^(r|refren|refrain|chorus)$/.test(token)
        ? "chorus"
        : /^(b|bridge|punte)$/.test(token)
          ? "bridge"
          : /^(final|ending|outro|coda)$/.test(token)
            ? "ending"
            : token.startsWith("pre")
              ? "prechorus"
              : /^(intro|tag|interlude|instrumental)$/.test(token)
                ? "text"
                : "verse";
      if (type === "verse") {
        verse = Number(number) || verse + 1;
        label = `Strofa ${verse}`;
      } else
        label = (
          {
            chorus: "Refren",
            bridge: "Bridge",
            ending: "Final",
            prechorus: "Pre-refren",
            text: "Text",
          } as Record<string, string>
        )[type];
      if (remainder) lines.push(remainder);
    } else if (!line.trim()) {
      // Blank lines delimit otherwise unlabelled stanzas; do not merge them.
      if (lines.length) {
        push();
        type = "verse";
        label = `Strofa ${++verse || 1}`;
      }
    } else lines.push(line);
  }
  push();
  if (!explicitType && !sections.some((section) => section.section_type === "chorus")) {
    const counts = new Map<string, number>();
    for (const section of sections) {
      const key = section.content.toLocaleLowerCase("ro").replace(/\s+/g, " ").trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const section of sections) {
      const key = section.content.toLocaleLowerCase("ro").replace(/\s+/g, " ").trim();
      if ((counts.get(key) || 0) > 1 && key.length >= 20) {
        section.section_type = "chorus";
        section.section_label = "Refren";
      }
    }
  }
  let verseNumber = 0;
  for (const section of sections) {
    if (section.section_type === "verse") section.section_label = `Strofa ${++verseNumber}`;
  }
  return { sections, structure };
}
function parseResursePage(html: string, sourceUrl: string): LinkPreview {
  const source = normalizeSongUrl(sourceUrl);
  const $ = load(html.replace(/(<br\s*\/?\s*>)[\r\n]+/gi, "$1"));
  const titleNode = $(".title").first().clone();
  titleNode.find("script,style,button,.resize-group").remove();
  const title = clean(
    $(".title .titleContent").first().text() ||
      $(".title h1").first().text() ||
      $("h1").first().text() ||
      titleNode.text(),
  );
  if (!title || title.length > 300) throw new Error("Nu am putut identifica titlul cântării în pagină.");
  const meta = $(".dottedSection.clearfix").first();
  const author = clean(meta.find('a[href*="/index-autori/"]:not([href*="/album/"])').first().text());
  const album = clean(meta.find('a[href*="/album/"]').first().text());
  const topic = clean(meta.find('a[href*="/index-tematic/"]').first().text());
  // The site duplicates lyrics for carousel, portrait and normal view. Use just
  // the normal view. Never flatten a generic .clearfix or the full page.
  const body = $(".resized-text").first().clone();
  body.find("script,style,button,nav,.commentsWrapper").remove();
  body.find("br").replaceWith("\n");
  body.find("p,div").append("\n");
  let text = clean(body.text());
  if (!text) {
    const blocks = $(".cantec-fullscreen .carousel-mode .strofa")
      .map((_, node) => {
        const stanza = $(node);
        const content = stanza.find(".strofa-text").clone();
        content.find("br").replaceWith("\n");
        return `${stanza.find(".strofa-label").text()}\n${content.text()}`;
      })
      .get();
    text = clean(blocks.join("\n\n"));
  }
  if (text.length < 20 || text.length > 100000)
    throw new Error(
      "Nu am identificat versurile. Poți folosi importul din text și verifica manual cântarea.",
    );
  const parsed = sectionsFromLyrics(text);
  if (!parsed.sections.length) throw new Error("Cântarea nu conține secțiuni cu versuri.");
  return {
    ...source,
    title,
    lyricsText: lyricsFromSections(parsed.sections),
    ...parsed,
    author,
    album,
    topic,
  };
}

function genericSongPage(html: string, sourceUrl: string): LinkPreview {
  const source = normalizeSongUrl(sourceUrl),
    $ = load(html.replace(/(<br\s*\/?\s*>)[\r\n]+/gi, "$1"));
  let composition: any = null;
  $("script[type='application/ld+json']").each((_, node) => {
    try {
      const parsed = JSON.parse($(node).text());
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        if (item["@graph"]) queue.push(...item["@graph"]);
        if (item.lyrics && !composition) composition = item;
      }
    } catch {}
  });
  const heading = $("h1").first().clone();
  heading.find(".key-group,.subtitle,button,select,script,style").remove();
  const title = clean(
    composition?.name || heading.text() || $("meta[property='og:title']").attr("content") || "",
  );
  if (!title || title.length > 300) throw new Error("Nu am identificat titlul cântării.");
  const sections: LinkSection[] = [];
  const seen = new Set<string>();
  let verse = 0;
  const container = $(".lyrics-container").first();
  container.children("[data-section-key]").each((_, node) => {
    const el = $(node),
      key = el.attr("data-section-key") || "";
    if (seen.has(key)) return;
    seen.add(key);
    const token = key.split("-")[0];
    const type = /chorus|refren/.test(token)
      ? "chorus"
      : /bridge/.test(token)
        ? "bridge"
        : /outro|ending|final/.test(token)
          ? "ending"
          : /pre/.test(token)
            ? "prechorus"
            : "verse";
    const part = el.clone();
    part.find(".chord,.section-label,script,style,button").remove();
    part.find("br").replaceWith("\n");
    const content = stripSectionMarkerLines(part.text());
    if (!content) return;
    const label =
      type === "verse"
        ? `Strofa ${++verse}`
        : (
            { chorus: "Refren", bridge: "Bridge", ending: "Final", prechorus: "Pre-refren" } as Record<
              string,
              string
            >
          )[type];
    sections.push({ section_type: type, section_label: label, position: sections.length + 1, content });
  });
  if (!sections.length) {
    let text = "";
    const lyric = composition?.lyrics;
    if (typeof lyric === "string") text = lyric;
    else if (typeof lyric?.text === "string") text = lyric.text;
    if (text) text = text.replace(/\[key\[[^\]]+\]\]/gi, "").replace(/\[\[[^\]]+\]\]/g, "");
    if (!text) {
      const selectors = [
        "[data-lyrics-container]",
        '[itemprop="lyrics"]',
        "[data-lyrics]",
        ".song-lyrics",
        ".lyricbox",
        "#lyrics",
        ".lyrics",
        ".lyrics-content",
        ".songtext",
        ".song-text",
      ];
      for (const selector of selectors) {
        const found = $(selector);
        if (!found.length) continue;
        text = found
          .map((_, node) => {
            const el = $(node).clone();
            el.find("script,style,nav,button,.chord,.comments,.advertisement").remove();
            el.find("br").replaceWith("\n");
            el.find("p,section").append("\n\n");
            return clean(el.text());
          })
          .get()
          .join("\n\n");
        if (text.trim()) break;
      }
    }
    if (!text) {
      // Ultimul fallback este limitat la conținutul principal și este acceptat
      // numai când găsim etichete explicite de secțiune. Astfel putem citi mai
      // multe site-uri fără să importăm meniuri, comentarii sau reclame.
      for (const selector of ["article", "main"]) {
        const found = $(selector).first();
        if (!found.length) continue;
        const el = found.clone();
        el.find("script,style,nav,header,footer,button,aside,form,.comments,.advertisement,.ads").remove();
        el.find("br").replaceWith("\n");
        el.find("p,section,div").append("\n");
        const candidate = clean(el.text());
        const markerCount = candidate.split("\n").filter((line) => SECTION_MARKER.test(line.trim())).length;
        if (markerCount >= 2) {
          text = candidate;
          break;
        }
      }
    }
    sections.push(...sectionsFromLyrics(text).sections);
  }
  const lyricsText = lyricsFromSections(sections);
  if (lyricsText.length < 20 || lyricsText.length > 100000 || !sections.length)
    throw new Error(
      "Nu am găsit un bloc de versuri în această pagină. Site-ul poate necesita JavaScript sau poate bloca citirea. Folosește importul din text.",
    );
  let verseIndex = 0;
  const structure = sections
    .map((part) =>
      part.section_type === "verse"
        ? `S${++verseIndex}`
        : ({ chorus: "R", bridge: "B", ending: "F", prechorus: "PR" } as Record<string, string>)[
            part.section_type
          ] || "S",
    )
    .join(", ");
  return {
    ...source,
    title,
    lyricsText,
    sections,
    structure,
    author: typeof composition?.composer?.name === "string" ? composition.composer.name : "",
    album: "",
    topic: "",
  };
}
export function parseSongPage(html: string, sourceUrl: string): LinkPreview {
  const host = new URL(normalizeSongUrl(sourceUrl).url).hostname;
  return host === "www.resursecrestine.ro"
    ? parseResursePage(html, sourceUrl)
    : genericSongPage(html, sourceUrl);
}
function parsePlainText(text: string, sourceUrl: string): LinkPreview {
  const source = normalizeSongUrl(sourceUrl);
  const cleaned = clean(text);
  const parsed = sectionsFromLyrics(cleaned);
  if (!parsed.sections.length || lyricsFromSections(parsed.sections).length < 20)
    throw new Error("Textul din link nu conține suficiente versuri.");
  const fileName = decodeURIComponent(
    new URL(source.url).pathname.split("/").filter(Boolean).at(-1) || "Cântare",
  )
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const title = (
    cleaned.split("\n").find((line) => !SECTION_MARKER.test(line) && line.length <= 160) ||
    fileName ||
    "Cântare importată"
  ).trim();
  return {
    ...source,
    title,
    lyricsText: lyricsFromSections(parsed.sections),
    ...parsed,
    author: "",
    album: "",
    topic: "",
  };
}
export async function readSongUrl(
  value: string,
  deps: { readPage?: (url: string) => Promise<PublicPage> } = {},
): Promise<LinkPreview> {
  let source = normalizeSongUrl(value);
  for (let step = 0; step < 4; step++) {
    let response: PublicPage;
    try {
      response = await (deps.readPage || fetchPublicPage)(source.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      throw new Error(
        /publică|prea mare|decodată/.test(message)
          ? message
          : "Pagina nu poate fi citită momentan. Verifică linkul și conexiunea sau folosește importul din text.",
      );
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.location) throw new Error("Redirecționare incompletă.");
      const next = normalizeSongUrl(new URL(response.location, source.url).href);
      if (source.sourceKey.startsWith("resursecrestine:") && next.sourceKey !== source.sourceKey)
        throw new Error("Linkul redirecționează către altă cântare. Folosește adresa finală.");
      source = next;
      continue;
    }
    if (response.status !== 200)
      throw new Error(
        [403, 429].includes(response.status)
          ? "Sursa nu permite citirea momentan. Folosește importul din text."
          : `Pagina nu este disponibilă (HTTP ${response.status}).`,
      );
    if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(response.contentType))
      throw new Error("Linkul nu returnează o pagină HTML sau text simplu.");
    if (Buffer.byteLength(response.html) > 2 * 1024 * 1024)
      throw new Error("Pagina este prea mare pentru preview.");
    return /text\/plain/i.test(response.contentType)
      ? parsePlainText(response.html, source.url)
      : parseSongPage(response.html, source.url);
  }
  throw new Error("Prea multe redirecționări. Folosește linkul direct.");
}
