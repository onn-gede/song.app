import JSZip from "jszip";

export type SongPptxSection = {
  section_type?: string | null;
  section_label?: string | null;
  content?: string | null;
};

export type SongPptxInput = {
  title: string;
  number?: string | null;
  sections: SongPptxSection[];
};

type PreparedSlide = {
  label: string;
  lines: string[];
  italic: boolean;
};

const SLIDE_RELATIONSHIP = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const SLIDE_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const MAX_VISUAL_LINES = 6;
// Echivalentul vizual a aproximativ 28 de caractere Arial la 46 pt în zona
// utilă a șablonului. Caracterele late consumă mai mult decât cele înguste.
const MAX_LINE_WIDTH = 28;

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizedLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function pptxLineWidth(value: string) {
  return Array.from(value).reduce((width, character) => {
    if (/\s/.test(character)) return width + 0.42;
    if (/[ilI1|.,'`:;!]/.test(character)) return width + 0.48;
    if (/[mwMW]/.test(character)) return width + 2.2;
    if (/[@%&#]/.test(character)) return width + 1.5;
    if (/[A-ZĂÂÎȘȚ]/.test(character)) return width + 1.08;
    return width + 0.92;
  }, 0);
}

function splitWideWord(word: string, limit: number) {
  const parts: string[] = [];
  let current = "";
  for (const character of Array.from(word)) {
    if (current && pptxLineWidth(current + character) > limit) {
      parts.push(current);
      current = character;
    } else current += character;
  }
  if (current) parts.push(current);
  return parts;
}

export function wrapPptxLine(value: string, limit = MAX_LINE_WIDTH) {
  const text = normalizedLine(value);
  if (!text) return [];
  const words = text
    .split(" ")
    .flatMap((word) => (pptxLineWidth(word) > limit ? splitWideWord(word, limit) : [word]));
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (pptxLineWidth(`${current} ${word}`) <= limit) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function validatePreparedSongPptxSlides(slides: PreparedSlide[]) {
  const issues: string[] = [];
  slides.forEach((slide, slideIndex) => {
    if (!slide.lines.length) issues.push(`Slide ${slideIndex + 1} nu conține text.`);
    if (slide.lines.length > MAX_VISUAL_LINES)
      issues.push(`Slide ${slideIndex + 1} depășește ${MAX_VISUAL_LINES} rânduri.`);
    slide.lines.forEach((line, lineIndex) => {
      if (pptxLineWidth(line) > MAX_LINE_WIDTH + 0.01)
        issues.push(`Slide ${slideIndex + 1}, rândul ${lineIndex + 1}, depășește lățimea sigură.`);
    });
  });
  return issues;
}

function sectionLabel(section: SongPptxSection) {
  const type = String(section.section_type || "").toLowerCase();
  const label = normalizedLine(section.section_label || "");
  if (type === "chorus" || /^(r\.?|refren)/i.test(label)) return "R.";
  if (type === "bridge" || /^bridge/i.test(label)) return "B.";
  if (type === "prechorus" || /^pre[- ]?refren/i.test(label)) return "P.R.";
  if (type === "ending" || /^(final|încheiere)/i.test(label)) return "F.";
  return "S.";
}

export function prepareSongPptxSlides(sections: SongPptxSection[]) {
  const slides: PreparedSlide[] = [];
  for (const section of sections) {
    const content = String(section.content || "")
      .replace(/\r\n?/g, "\n")
      .trim();
    if (!content) continue;
    const visualLines = content.split("\n").flatMap((line) => wrapPptxLine(line));
    // Distribuie rândurile cât mai egal între slide-uri. De exemplu, o
    // strofă de 7 rânduri devine 4 + 3, nu 6 + 1.
    const slideCount = Math.ceil(visualLines.length / MAX_VISUAL_LINES);
    const baseSize = Math.floor(visualLines.length / slideCount);
    const largerSlides = visualLines.length % slideCount;
    let index = 0;
    for (let slideIndex = 0; slideIndex < slideCount; slideIndex += 1) {
      const size = baseSize + (slideIndex < largerSlides ? 1 : 0);
      slides.push({
        label: sectionLabel(section),
        lines: visualLines.slice(index, index + size),
        italic: false,
      });
      index += size;
    }
  }
  return slides;
}

export function safeSongPptxFileName(title: string, number?: string | null) {
  const cleanTitle =
    normalizedLine(title)
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "") || "Cântare";
  const cleanNumber = normalizedLine(number || "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "");
  return `${cleanNumber ? `${cleanNumber}. ` : ""}${cleanTitle}.pptx`;
}

function runProperties(italic: boolean, size: number) {
  return `<a:rPr lang="ro-RO" sz="${size}" b="0"${italic ? ' i="1"' : ""} dirty="0" smtClean="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Arial" pitchFamily="34" charset="0"/><a:cs typeface="Arial" pitchFamily="34" charset="0"/></a:rPr>`;
}

function headerParagraph(title: string, number: string, label: string, includeNumber: boolean) {
  const headerRun = (text: string) => `<a:r>${runProperties(true, 2000)}<a:t>${xmlEscape(text)}</a:t></a:r>`;
  return `<a:p><a:pPr algn="l" eaLnBrk="1" hangingPunct="1"><a:tabLst><a:tab pos="5556250" algn="ctr"/><a:tab pos="11304588" algn="r"/></a:tabLst><a:defRPr/></a:pPr>${headerRun(label)}${headerRun("\t")}${headerRun(title)}${headerRun("\t")}${includeNumber && number ? headerRun(number) : ""}<a:endParaRPr lang="ro-RO" sz="2000" i="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Arial" pitchFamily="34" charset="0"/></a:endParaRPr></a:p>`;
}

function bodyParagraph(line: string, italic: boolean) {
  return `<a:p><a:pPr eaLnBrk="1" hangingPunct="1"><a:lnSpc><a:spcPct val="110000"/></a:lnSpc><a:spcBef><a:spcPct val="0"/></a:spcBef><a:buNone/><a:defRPr/></a:pPr><a:r>${runProperties(italic, 4600)}<a:t>${xmlEscape(line)}</a:t></a:r><a:endParaRPr lang="ro-RO" sz="4600"${italic ? ' i="1"' : ""}><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Arial" pitchFamily="34" charset="0"/></a:endParaRPr></a:p>`;
}

function slideXml(title: string, number: string, slide: PreparedSlide, index: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="34818" name="Rectangle 2"/><p:cNvSpPr><a:spLocks noGrp="1" noChangeArrowheads="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="11522075" cy="503238"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${headerParagraph(title, number, slide.label, index === 0)}</p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="34819" name="Rectangle 3"/><p:cNvSpPr><a:spLocks noGrp="1" noChangeArrowheads="1"/></p:cNvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="1189005" y="1025509"/><a:ext cx="10333070" cy="5454666"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${slide.lines.map((line) => bodyParagraph(line, slide.italic)).join("")}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:transition><p:strips dir="ld"/></p:transition><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"/></p:par></p:tnLst></p:timing></p:sld>`;
}

function slideRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/></Relationships>`;
}

function replaceRequired(source: string, matcher: RegExp, replacement: string, label: string) {
  if (!matcher.test(source)) throw new Error(`Șablonul PPTX nu conține ${label}.`);
  return source.replace(matcher, replacement);
}

export async function buildSongPptx(template: ArrayBuffer | Uint8Array, input: SongPptxInput) {
  const title = normalizedLine(input.title);
  if (!title) throw new Error("Cântarea nu are titlu.");
  const slides = prepareSongPptxSlides(input.sections);
  if (!slides.length) throw new Error("Cântarea nu are versuri structurate pentru export.");
  const layoutIssues = validatePreparedSongPptxSlides(slides);
  if (layoutIssues.length) throw new Error(`Versurile nu pot fi încadrate în siguranță: ${layoutIssues[0]}`);

  const zip = await JSZip.loadAsync(template);
  const presentationPath = "ppt/presentation.xml";
  const presentationRelsPath = "ppt/_rels/presentation.xml.rels";
  const contentTypesPath = "[Content_Types].xml";
  const presentation = await zip.file(presentationPath)?.async("string");
  const presentationRels = await zip.file(presentationRelsPath)?.async("string");
  const contentTypes = await zip.file(contentTypesPath)?.async("string");
  if (!presentation || !presentationRels || !contentTypes || !zip.file("ppt/slideLayouts/slideLayout2.xml")) {
    throw new Error("Șablonul PPTX este incomplet.");
  }

  for (const path of Object.keys(zip.files)) {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(path) || /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(path))
      zip.remove(path);
  }

  const slideIds = slides
    .map((_, index) => `<p:sldId id="${1000 + index}" r:id="rId${100 + index}"/>`)
    .join("");
  const newPresentation = replaceRequired(
    presentation,
    /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
    `<p:sldIdLst>${slideIds}</p:sldIdLst>`,
    "lista de slide-uri",
  );

  const withoutOldSlideRels = presentationRels.replace(
    new RegExp(
      `<Relationship\\b(?=[^>]*Type="${SLIDE_RELATIONSHIP.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}")[^>]*/>`,
      "g",
    ),
    "",
  );
  const newSlideRels = slides
    .map(
      (_, index) =>
        `<Relationship Id="rId${100 + index}" Type="${SLIDE_RELATIONSHIP}" Target="slides/slide${index + 1}.xml"/>`,
    )
    .join("");
  const newPresentationRels = replaceRequired(
    withoutOldSlideRels,
    /<\/Relationships>/,
    `${newSlideRels}</Relationships>`,
    "relațiile prezentării",
  );

  const withoutOldSlideTypes = contentTypes.replace(
    /<Override\b(?=[^>]*PartName="\/ppt\/slides\/slide\d+\.xml")[^>]*\/>/g,
    "",
  );
  const newSlideTypes = slides
    .map(
      (_, index) =>
        `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="${SLIDE_CONTENT_TYPE}"/>`,
    )
    .join("");
  const newContentTypes = replaceRequired(
    withoutOldSlideTypes,
    /<\/Types>/,
    `${newSlideTypes}</Types>`,
    "tipurile de conținut",
  );

  zip.file(presentationPath, newPresentation);
  zip.file(presentationRelsPath, newPresentationRels);
  zip.file(contentTypesPath, newContentTypes);
  slides.forEach((slide, index) => {
    zip.file(
      `ppt/slides/slide${index + 1}.xml`,
      slideXml(title, normalizedLine(input.number || ""), slide, index),
    );
    zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, slideRelsXml());
  });

  const appPath = "docProps/app.xml";
  const appXml = await zip.file(appPath)?.async("string");
  if (appXml) zip.file(appPath, appXml.replace(/<Slides>\d+<\/Slides>/, `<Slides>${slides.length}</Slides>`));
  const corePath = "docProps/core.xml";
  const coreXml = await zip.file(corePath)?.async("string");
  if (coreXml)
    zip.file(
      corePath,
      coreXml.replace(/<dc:title>[\s\S]*?<\/dc:title>/, `<dc:title>${xmlEscape(title)}</dc:title>`),
    );

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
