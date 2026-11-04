export type FreeShowSection = {
  label: string;
  type: "verse" | "chorus" | "bridge" | "prechorus" | "ending" | "text";
  content: string;
};

export type FreeShowImport = {
  title: string;
  sections: FreeShowSection[];
  lyricsText: string;
  structure: string | null;
  defaultKey: string | null;
  songNumber: string | null;
};

type ExportSlide = { label: string; content: string; color?: string | null };

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

function sectionType(label: string): FreeShowSection["type"] {
  const value = label.toLowerCase();
  if (/chorus|refren|refrain/.test(value)) return "chorus";
  if (/pre.?chorus|pre.?refren/.test(value)) return "prechorus";
  if (/bridge|punte/.test(value)) return "bridge";
  if (/ending|final|outro/.test(value)) return "ending";
  if (/verse|vers|strof/.test(value)) return "verse";
  return "text";
}

function defaultLabel(type: FreeShowSection["type"], index: number) {
  if (type === "chorus") return "Refren";
  if (type === "prechorus") return "Pre-refren";
  if (type === "bridge") return "Bridge";
  if (type === "ending") return "Final";
  if (type === "verse") return `Strofa ${index + 1}`;
  return `Text ${index + 1}`;
}

function textFromItem(item: unknown) {
  const data = object(item);
  if (data.type && data.type !== "text") return "";
  const lines = Array.isArray(data.lines) ? data.lines : [];
  return lines.map((line: unknown) => {
    const row = object(line);
    const fragments = Array.isArray(row.text) ? row.text : [];
    return fragments.map((fragment: unknown) => cleanText(object(fragment).value)).filter(Boolean).join("");
  }).join("\n").trim();
}

function orderedSlideIds(show: Record<string, any>) {
  const slides = object(show.slides);
  const layouts = object(show.layouts);
  const activeLayout = cleanText(object(show.settings).activeLayout);
  const layout = object(layouts[activeLayout] || Object.values(layouts)[0]);
  const refs = Array.isArray(layout.slides) ? layout.slides : [];
  const roots = refs.map((entry: unknown) => cleanText(typeof entry === "string" ? entry : object(entry).id)).filter(Boolean);
  const result: string[] = [];
  const append = (id: string, ancestors: Set<string>) => {
    if (!slides[id] || ancestors.has(id)) return;
    result.push(id);
    const next = new Set(ancestors); next.add(id);
    const children = Array.isArray(object(slides[id]).children) ? object(slides[id]).children : [];
    children.map(cleanText).filter(Boolean).forEach((child: string) => append(child, next));
  };
  (roots.length ? roots : Object.keys(slides)).forEach((id) => append(id, new Set()));
  return result.slice(0, 1000);
}

export function parseFreeShow(raw: string | unknown): FreeShowImport {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const show = object(parsed);
  if (!Object.keys(object(show.slides)).length) throw new Error("Fișierul nu conține slide-uri FreeShow.");

  const sections = orderedSlideIds(show).map((id, index) => {
    const slide = object(object(show.slides)[id]);
    const candidates = (Array.isArray(slide.items) ? slide.items : []).map(textFromItem).filter(Boolean).sort((a: string, b: string) => b.length - a.length);
    const label = cleanText(slide.group);
    const type = sectionType(label);
    return { label: label || defaultLabel(type, index), type, content: candidates[0] || "" };
  }).filter((section) => section.content).slice(0, 500);

  if (!sections.length) throw new Error("Fișierul FreeShow nu conține text care poate fi importat.");
  const title = cleanText(show.name || object(show.meta).title) || "Cântare importată din FreeShow";
  const lyricsText = sections.map((section) => `${section.label}\n${section.content}`).join("\n\n").slice(0, 1_000_000);
  const tokens: Record<FreeShowSection["type"], string> = {verse:"S",chorus:"R",bridge:"B",prechorus:"PR",ending:"F",text:"T"};
  return {
    title: title.slice(0, 240),
    sections,
    lyricsText,
    structure: sections.map((section) => tokens[section.type]).join(",") || null,
    defaultKey: cleanText(object(show.meta).key).slice(0, 20) || null,
    songNumber: cleanText(object(show.meta).number).slice(0, 80) || null,
  };
}

export function buildFreeShow(name: string, slides: ExportSlide[], meta: Record<string, string | null | undefined> = {}) {
  const prepared = slides.map((slide) => ({...slide,content:cleanText(slide.content)})).filter((slide) => slide.content);
  if (!prepared.length) throw new Error("Nu există versuri pentru export.");
  const slideMap: Record<string, any> = {};
  const layoutSlides: Array<{id:string}> = [];
  prepared.forEach((slide, index) => {
    const id = `songapp-slide-${index + 1}`;
    layoutSlides.push({id});
    slideMap[id] = {
      group: slide.label || `Slide ${index + 1}`,
      color: slide.color || "#28624c",
      settings: { resolution: { width: 1920, height: 1080 } },
      notes: "",
      items: [{
        type: "text",
        lines: slide.content.split("\n").map((line) => ({align:"text-align:center;",text:[{value:line,style:"font-size:96px;"}]})),
        style: "top:120px;left:80px;height:840px;width:1760px;font-family:Arial;",
        align: "align-items:center;",
        language: "",
      }],
    };
  });
  const now = Date.now();
  return {
    name: cleanText(name).slice(0, 240) || "SongApp export",
    category: null,
    settings: { activeLayout: "songapp-layout", template: null },
    timestamps: { created: now, modified: now, used: null },
    meta: {
      number: meta.number || "", title: meta.title || name, artist: meta.artist || "", author: meta.author || "",
      composer: meta.composer || "", publisher: meta.publisher || "", copyright: meta.copyright || "", CCLI: meta.CCLI || "", year: meta.year || "", key: meta.key || "",
    },
    slides: slideMap,
    layouts: { "songapp-layout": { name: "SongApp", notes: "Exportat din SongApp BCBgiroc", slides: layoutSlides } },
    media: {},
  };
}

export function safeFreeShowFileName(value: string) {
  const clean = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._ -]+/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
  return `${clean || "cantare-songapp"}.show`;
}
