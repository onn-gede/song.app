"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import JSZip from "jszip";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createClient } from "@/lib/supabase/server";

const allowedSourceTypes = new Set(["manual", "pptx", "ppt", "pdf", "txt", "docx", "other"]);
const supportedFileExtensions = new Set(["txt", "md", "pptx", "ppt", "pdf", "zip"]);
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const STORAGE_BUCKET = "song-files";
const execFileAsync = promisify(execFile);

export type ParsedImport = {
  fileName: string;
  fileType: "txt" | "pptx" | "ppt" | "pdf" | "zip" | "other";
  title: string;
  songNumber: string | null;
  lyricsText: string;
  parserNotes: string;
  storagePath?: string | null;
};

export type ImportDuplicateCandidate = {
  songId: string;
  title: string;
  songNumber: string | null;
  collectionName: string | null;
  reason: string;
};

export type ImportPreviewItem = ParsedImport & {
  previewId: string;
  duplicates: ImportDuplicateCandidate[];
  importIssues: string[];
  canImport: boolean;
};

export type ConfirmImportBatchError = {
  previewId: string;
  fileName: string;
  title: string;
  message: string;
};

export type ConfirmImportBatchResult = {
  processed: number;
  createdOrUpdatedIds: string[];
  skipped: number;
  errors: ConfirmImportBatchError[];
};

export type ImportPreviewResult = {
  collectionId: string;
  collectionName: string;
  items: ImportPreviewItem[];
  duplicateCount: number;
  metadata: {
    defaultKey: string | null;
    bpm: number | null;
    structure: string | null;
    notes: string | null;
  };
};

function readString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function readNullableString(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value.length > 0 ? value : null;
}

function readNullableInteger(formData: FormData, key: string) {
  const raw = readString(formData, key);
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) return null;
  return value;
}

function normalizeCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ăâ]/gi, "a")
    .replace(/[î]/gi, "i")
    .replace(/[șş]/gi, "s")
    .replace(/[țţ]/gi, "t")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

function slugPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "fisier";
}

function getExtension(fileName: string) {
  const cleanName = fileName.split("?")[0] || fileName;
  const parts = cleanName.split(".");
  return parts.length > 1 ? String(parts.pop()).toLowerCase() : "";
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim();
}

function decodePowerPointUnicodeEscapes(value: string) {
  return value.replace(/#U([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function titleCaseFromFile(value: string) {
  return decodePowerPointUnicodeEscapes(value)
    .replace(/[_]+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function inferNumberAndTitle(fileName: string) {
  const base = titleCaseFromFile(stripExtension(fileName));
  const match = base.match(/^\s*(\d{1,4}[a-z]?)\s*(?:[-–—_.\s]+)\s*(.+)$/i);
  if (match) {
    return {
      songNumber: match[1],
      title: titleCaseFromFile(match[2]) || base
    };
  }

  return { songNumber: null, title: base || "Cântare importată" };
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stripXmlThatLeakedIntoText(value: string) {
  return value
    .replace(/<\/?[a-zA-Z0-9]+:[^>]*>/g, " ")
    .replace(/<\/?[^>]+>/g, " ");
}

function normalizeExtractedText(value: string) {
  return stripXmlThatLeakedIntoText(value)
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isChordOnlyLine(line: string) {
  const value = line
    .replace(/[|·•]/g, " ")
    .replace(/[.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return false;
  if (value.length > 80) return false;

  const chordToken = "[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\\d*(?:/[A-G](?:#|b)?)?";
  const chordLineRegex = new RegExp(`^(?:${chordToken})(?:\\s+(?:${chordToken}))*$`, "i");

  return chordLineRegex.test(value);
}

function removeChordOnlyLines(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trim() || !isChordOnlyLine(line))
    .join("\n");
}

function normalizeHeaderLine(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ăâ]/gi, "a")
    .replace(/[î]/gi, "i")
    .replace(/[șş]/gi, "s")
    .replace(/[țţ]/gi, "t")
    .toLowerCase()
    .replace(/&/g, " si ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSongHeaderLine(line: string, title: string, songNumber?: string | null) {
  const normalizedLine = normalizeHeaderLine(line);
  const normalizedTitle = normalizeHeaderLine(title);
  const normalizedNumber = normalizeHeaderLine(String(songNumber || ""));
  if (!normalizedLine) return false;

  const compactLine = normalizedLine.replace(/\s+/g, "");
  const compactTitle = normalizedTitle.replace(/\s+/g, "");
  const compactNumber = normalizedNumber.replace(/\s+/g, "");

  if (compactTitle && compactLine === compactTitle) return true;
  if (compactNumber && compactLine === compactNumber) return true;
  if (compactTitle && compactNumber && compactLine === `${compactNumber}${compactTitle}`) return true;
  if (compactTitle && compactNumber && compactLine === `${compactTitle}${compactNumber}`) return true;

  // Unele PPTX-uri pun numărul și titlul în același paragraf/header.
  if (compactTitle && compactNumber && compactLine.includes(compactTitle) && compactLine.includes(compactNumber) && compactLine.length <= compactTitle.length + compactNumber.length + 8) {
    return true;
  }

  return false;
}

function removeRepeatedTitleLines(text: string, title: string, songNumber?: string | null) {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      if (!line.trim()) return true;
      return !isSongHeaderLine(line, title, songNumber);
    })
    .join("\n");
}

function normalizeForLooseCompare(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ăâ]/gi, "a")
    .replace(/[î]/gi, "i")
    .replace(/[șş]/gi, "s")
    .replace(/[țţ]/gi, "t")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getSlideHeaderReplacement(line: string, title: string, songNumber?: string | null) {
  const looseLine = normalizeForLooseCompare(line);
  const looseTitle = normalizeForLooseCompare(title);
  const looseNumber = normalizeForLooseCompare(String(songNumber || ""));

  const looksLikeHeader = Boolean(looseTitle && looseLine.includes(looseTitle)) || Boolean(looseNumber && looseLine.includes(looseNumber) && looseLine.length <= looseNumber.length + 4);
  if (!looksLikeHeader) return null;

  const marker = line.trim().match(/^(r|refren|chorus|\d{1,3})[\s.):-]*/i)?.[1];
  if (!marker) return "";
  if (/^(r|refren|chorus)$/i.test(marker)) return "Refren";
  return `Strofa ${marker}`;
}

function cleanPptxSlideText(slideText: string, title: string, songNumber?: string | null) {
  const lines = slideText.split(/\r?\n/);
  if (lines.length === 0) return slideText;

  const firstLineReplacement = getSlideHeaderReplacement(lines[0], title, songNumber);
  if (firstLineReplacement !== null) {
    if (firstLineReplacement) lines[0] = firstLineReplacement;
    else lines.shift();
  }

  return removeRepeatedTitleLines(lines.join("\n"), title, songNumber);
}

function detectSectionType(block: string) {
  const firstLine = block.split(/\r?\n/)[0]?.trim().toLowerCase() || "";
  if (firstLine.includes("refren") || firstLine === "r" || firstLine.startsWith("chorus")) return "chorus";
  if (firstLine.includes("bridge")) return "bridge";
  if (firstLine.includes("final") || firstLine.includes("ending")) return "ending";
  if (firstLine.includes("pre-refren") || firstLine.includes("prechorus")) return "prechorus";
  return "verse";
}

function detectSectionLabel(block: string, index: number, type: string) {
  const firstLine = block.split(/\r?\n/)[0]?.trim() || "";
  if (/^(strofa|strofă|vers|v\.?|refren|r\.?|bridge|final|ending|pre-refren|prechorus)/i.test(firstLine)) {
    return firstLine.slice(0, 60);
  }
  if (type === "chorus") return "Refren";
  if (type === "bridge") return "Bridge";
  if (type === "ending") return "Final";
  return `Strofa ${index + 1}`;
}

function stripSectionLabelFromContent(block: string) {
  const lines = block.split(/\r?\n/);
  const firstLine = lines[0]?.trim() || "";
  const labelOnlyRegex = /^(strofa|strofă|vers|v\.?)\s*\d{0,3}$|^(refren|r\.?|bridge|final|ending|pre-refren|prechorus)$/i;

  if (lines.length > 1 && labelOnlyRegex.test(firstLine)) {
    return lines.slice(1).join("\n").trim() || block;
  }

  return block;
}

function cleanSectionBlock(block: string, title?: string, songNumber?: string | null) {
  const withoutSongHeader = title ? removeRepeatedTitleLines(block, title, songNumber) : block;
  return withoutSongHeader
    .split(/\r?\n/)
    .filter((line) => !title || !isSongHeaderLine(line, title, songNumber))
    .join("\n")
    .trim();
}

function parseSections(lyricsText: string, title?: string, songNumber?: string | null) {
  const cleanedText = title ? removeRepeatedTitleLines(lyricsText, title, songNumber) : lyricsText;
  const blocks = cleanedText
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((block) => cleanSectionBlock(block.trim(), title, songNumber))
    .filter(Boolean);

  const sourceBlocks = blocks.length > 0 ? blocks : [cleanSectionBlock(cleanedText.trim(), title, songNumber)].filter(Boolean);

  return sourceBlocks.map((block, index) => {
    const sectionType = detectSectionType(block);
    return {
      section_type: sectionType,
      section_label: detectSectionLabel(block, index, sectionType),
      position: index + 1,
      content: stripSectionLabelFromContent(cleanSectionBlock(block, title, songNumber))
    };
  });
}

async function maybeCreateCollection(name: string, sourceType: string) {
  const supabase = await createClient();
  const shortCodeBase = normalizeCode(name) || "IMPORT";
  const { data: existing } = await supabase
    .from("song_collections")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: sameCode } = await supabase
    .from("song_collections")
    .select("short_code")
    .like("short_code", `${shortCodeBase}%`);

  const used = new Set((sameCode || []).map((item: any) => item.short_code));
  let shortCode = shortCodeBase;
  let counter = 2;
  while (used.has(shortCode)) {
    shortCode = `${shortCodeBase}_${counter}`.slice(0, 28);
    counter += 1;
  }

  const { data, error } = await supabase
    .from("song_collections")
    .insert({ name, short_code: shortCode, source_type: sourceType, is_active: true })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

async function resolveCollectionId(formData: FormData, sourceType: string) {
  const selectedCollectionId = readString(formData, "collection_id");
  const newCollectionName = readString(formData, "new_collection_name");
  if (!selectedCollectionId && !newCollectionName) throw new Error("Alege o colecție sau creează una nouă.");
  return selectedCollectionId || await maybeCreateCollection(newCollectionName, sourceType);
}

async function uploadOriginalFile(_file: File, _collectionId: string) {
  // v18: nu mai stocăm fișierul original în Supabase Storage.
  // După extragerea textului, păstrăm doar datele necesare în DB ca să nu ocupăm spațiu.
  return { storagePath: null, warning: null };
}

function isLegacyPptImportEnabled() {
  return String(process.env.ENABLE_LEGACY_PPT_IMPORT || "").trim().toLowerCase() === "true";
}

function cleanEnvPath(value: string | undefined) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

function libreOfficeCandidates() {
  const configured = cleanEnvPath(process.env.LIBREOFFICE_PATH);
  const candidates = [
    configured,
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/libreoffice",
    "/usr/local/bin/libreoffice",
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
    "libreoffice",
    "soffice"
  ];

  return Array.from(new Set(candidates.filter(Boolean)));
}

async function runLibreOfficeConversion(sofficePath: string, inputPath: string, outputDir: string, explicitFilter = false) {
  const convertTarget = explicitFilter ? 'pptx:Impress MS PowerPoint 2007 XML' : 'pptx';
  await execFileAsync(sofficePath, [
    "--headless",
    "--nologo",
    "--nofirststartwizard",
    "--convert-to",
    convertTarget,
    "--outdir",
    outputDir,
    inputPath
  ], { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 });
}

async function findConvertedPptx(outputDir: string, originalFileName: string) {
  const expectedBase = stripExtension(path.basename(originalFileName)).toLowerCase();
  const files = await readdir(outputDir);
  const pptxFiles = files.filter((file) => file.toLowerCase().endsWith(".pptx"));
  if (pptxFiles.length === 0) return null;

  const exact = pptxFiles.find((file) => stripExtension(file).toLowerCase() === expectedBase);
  return path.join(outputDir, exact || pptxFiles[0]);
}

async function convertLegacyPptToPptxBuffer(buffer: Buffer, fileName: string) {
  if (!isLegacyPptImportEnabled()) {
    throw new Error(
      `${fileName} este format PowerPoint vechi (.ppt). Importul PPT vechi este dezactivat. Convertește fișierul în .pptx sau setează ENABLE_LEGACY_PPT_IMPORT="true" doar pe calculatorul/serverul de import.`
    );
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "songapp-ppt-"));
  const inputPath = path.join(tempDir, `${slugPart(stripExtension(fileName)) || "import"}.ppt`);
  const outputDir = path.join(tempDir, "out");

  try {
    await writeFile(inputPath, buffer);
    await import("node:fs/promises").then((fs) => fs.mkdir(outputDir, { recursive: true }));

    let lastError: unknown = null;
    for (const sofficePath of libreOfficeCandidates()) {
      for (const explicitFilter of [false, true]) {
        try {
          await runLibreOfficeConversion(sofficePath, inputPath, outputDir, explicitFilter);
          const convertedPath = await findConvertedPptx(outputDir, fileName);
          if (convertedPath) {
            return await readFile(convertedPath);
          }
        } catch (error) {
          lastError = error;
        }
      }
    }

    const details = lastError instanceof Error ? lastError.message : String(lastError || "LibreOffice nu a returnat un fișier PPTX.");
    throw new Error(
      `Nu am putut converti ${fileName} din .ppt în .pptx cu LibreOffice. Verifică LIBREOFFICE_PATH în .env.local. Detalii: ${details}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}


function extractTextFromPptxParagraph(paragraphXml: string) {
  const paragraphWithVirtualText = paragraphXml
    .replace(/<a:br\b[^>]*\/>/gi, "<a:t>\n</a:t>")
    .replace(/<a:tab\b[^>]*\/>/gi, "<a:t> </a:t>");

  // Important: match only the real PowerPoint text tag <a:t>, not <a:tab>, <a:tabLst> etc.
  const textRuns = [...paragraphWithVirtualText.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
    .map((match) => decodeXmlEntities(match[1] || ""));

  return normalizeExtractedText(textRuns.join(""));
}

function extractTextFromPptxSlideXml(xml: string) {
  const paragraphs = [...xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)]
    .map((match) => extractTextFromPptxParagraph(match[1] || ""))
    .flatMap((paragraph) => paragraph.split(/\r?\n/))
    .map((line) => normalizeExtractedText(line))
    .filter(Boolean);

  const linesWithoutAdjacentDuplicates = paragraphs.filter((line, index, arr) => {
    if (index === 0) return true;
    return line.trim().toLowerCase() !== arr[index - 1].trim().toLowerCase();
  });

  return removeChordOnlyLines(linesWithoutAdjacentDuplicates.join("\n")).trim();
}

async function parsePptxBuffer(buffer: Buffer, fileName: string) {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const aNum = Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0);
      const bNum = Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0);
      return aNum - bNum;
    });

  if (slideNames.length === 0) throw new Error(`Nu am găsit slide-uri în ${fileName}.`);

  const inferred = inferNumberAndTitle(fileName);
  const blocks: string[] = [];
  for (const slideName of slideNames) {
    const xml = await zip.file(slideName)?.async("string");
    if (!xml) continue;
    const rawSlideText = extractTextFromPptxSlideXml(xml);
    const slideText = cleanPptxSlideText(rawSlideText, inferred.title, inferred.songNumber);
    if (slideText) blocks.push(slideText);
  }

  const withoutRepeatedTitles = removeRepeatedTitleLines(blocks.join("\n\n"), inferred.title, inferred.songNumber);
  const text = normalizeExtractedText(removeChordOnlyLines(withoutRepeatedTitles));

  return {
    text,
    note: `Import automat din PPTX: ${slideNames.length} slide-uri citite. Parser v9.2: citește paragrafele PowerPoint, lipește fragmentele rupte de formatare și elimină liniile care sunt doar acorduri. Verifică împărțirea pe strofe/refren.`
  };
}



function isLikelyOleCompoundFile(buffer: Buffer) {
  return buffer.length > 8 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
}

function isLikelyZipPackage(buffer: Buffer) {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function safeDecodeBuffer(buffer: Buffer, encoding: string) {
  try {
    return new TextDecoder(encoding as any, { fatal: false }).decode(buffer);
  } catch {
    return buffer.toString("latin1");
  }
}

function extractUtf16LeStrings(buffer: Buffer) {
  const results: string[] = [];

  for (const offset of [0, 1]) {
    let current: number[] = [];

    function flush() {
      if (current.length >= 3) {
        const text = String.fromCharCode(...current)
          .replace(/[\u0000-\u001f\u007f]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (text.length >= 2) results.push(text);
      }
      current = [];
    }

    for (let index = offset; index < buffer.length - 1; index += 2) {
      const code = buffer[index] + (buffer[index + 1] << 8);
      const printable = code === 10 || code === 13 || code === 9 || (code >= 32 && code <= 0x024f);
      if (printable) current.push(code);
      else flush();
    }
    flush();
  }

  return results;
}

function extractSingleByteStrings(buffer: Buffer, encoding: "windows-1250" | "latin1" | "utf-8") {
  const results: string[] = [];
  let bytes: number[] = [];

  function flush() {
    if (bytes.length >= 4) {
      const text = safeDecodeBuffer(Buffer.from(bytes), encoding)
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length >= 3) results.push(text);
    }
    bytes = [];
  }

  for (const byte of buffer) {
    const printable = byte === 9 || byte === 10 || byte === 13 || byte >= 32;
    if (printable) bytes.push(byte);
    else flush();
  }
  flush();
  return results;
}

function hasTooMuchBinaryNoise(value: string) {
  const text = value.trim();
  if (!text) return true;

  const cjkOrPrivate = (text.match(/[\u2E80-\u9FFF\uAC00-\uD7AF\uE000-\uF8FF]/g) || []).length;
  if (cjkOrPrivate > 0 && cjkOrPrivate / Math.max(text.length, 1) > 0.08) return true;

  const replacement = (text.match(/�/g) || []).length;
  if (replacement > 0 && replacement / Math.max(text.length, 1) > 0.05) return true;

  const latinLetters = (text.match(/[A-Za-zĂÂÎȘŞȚŢăâîșşțţ]/g) || []).length;
  const digits = (text.match(/[0-9]/g) || []).length;
  const useful = latinLetters + digits;
  const oddSymbols = (text.match(/[{}\[\]\\|~^`_=<>§¤°]/g) || []).length;
  if (text.length > 12 && useful / text.length < 0.28) return true;
  if (text.length > 20 && oddSymbols / text.length > 0.18) return true;

  return false;
}

function looksLikeLegacyPptNoise(value: string) {
  const text = value.trim();
  if (!text) return true;
  if (text.length > 320) return true;
  if (hasTooMuchBinaryNoise(text)) return true;
  if (/^[\d\s\W_]+$/.test(text) && !/[A-Za-zĂÂÎȘŞȚŢăâîșşțţ]/.test(text)) return true;
  if (/^(Microsoft|PowerPoint|Document|Summary|Information|Root Entry|Current User|Pictures|ObjectPool|CompObj|Ole|VBA|SlideList|Persist|UserEdit|Times New Roman|Arial|MS Gothic|Arial Unicode MS|Calibri|Cambria|Temă|Tema|Ecran lat|Fonturi utilizate|Titluri diapozitive|Romanian Baptist Church|Proiector|Rectangle\s*\d*)$/i.test(text)) return true;
  if (/^(Microsoft|PowerPoint|Document|Summary|Information|Root Entry|Current User|Pictures|ObjectPool|CompObj|Ole|VBA|SlideList|Persist|UserEdit)/i.test(text)) return true;
  if (/\.(wmf|emf|png|jpg|jpeg|gif|xml|rels|bin|dat)$/i.test(text)) return true;
  if (/(\[Content_Types\]\.xml|_rels\/|drs\/|theme\/|slideLayouts\/|\.xmlPK|PK\x03|___PPT\d+)/i.test(text)) return true;
  if (/^[_\-+$#@%*&=~^`{}\[\]\\\/|:;.,!?'"()<>\s]{4,}$/.test(text)) return true;
  if (/^[A-Za-z0-9+\/]{12,}={0,2}$/.test(text) && !/\s/.test(text)) return true;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return true;
  const letters = (text.match(/[A-Za-zĂÂÎȘŞȚŢăâîșşțţ]/g) || []).length;
  if (letters < 2 && text.length > 8) return true;
  return false;
}

function splitLegacyPptCandidate(value: string) {
  return normalizeExtractedText(value)
    .replace(/[\uF000-\uF8FF]/g, " ")
    .replace(/\b(?:Times New Roman|Arial Unicode MS|Arial|MS Gothic|Calibri|Cambria)\b/gi, "\n")
    .replace(/\b(?:Rectangle\s*\d*|Ecran lat|Fonturi utilizate|Titluri diapozitive|Romanian Baptist Church of Portland|Proiector BCBGiroc)\b/gi, "\n")
    .replace(/(?:\[Content_Types\]\.xml|_rels\/|drs\/|theme\/|slideLayouts\/|___PPT\d+|PK\S*)/gi, "\n")
    .replace(/\s+(?=(?:R|Refren|Strofa|Strofă|\d{1,2}[.)])\s+)/gi, "\n")
    .split(/(?:\r?\n|\u2028|\u2029|\s{4,})/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeLegacyPptLines(values: string[], title: string, songNumber: string | null) {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const raw of values) {
    for (const part of splitLegacyPptCandidate(raw)) {
      const line = normalizeExtractedText(part)
        .replace(/[\uF000-\uF8FF]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

      if (!line || looksLikeLegacyPptNoise(line)) continue;
      if (isChordOnlyLine(line)) continue;
      if (isSongHeaderLine(line, title, songNumber)) continue;
      const key = normalizeForLooseCompare(line);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      lines.push(line);
    }
  }

  return lines.join("\n");
}

async function extractLegacyPptStreams(buffer: Buffer) {
  const streams: { name: string; content: Buffer; priority: number }[] = [];

  if (!isLikelyOleCompoundFile(buffer)) {
    return [{ name: "raw-file", content: buffer, priority: 0 }];
  }

  try {
    const cfbModule = await import("cfb");
    const CFB = (cfbModule as any).default || cfbModule;
    const workbook = CFB.read(buffer, { type: "buffer" });
    const entries = Array.isArray(workbook?.FileIndex) ? workbook.FileIndex : [];

    for (const entry of entries) {
      const name = String(entry?.name || "");
      const content = Buffer.from(entry?.content || []);
      if (!content.length) continue;
      if (/^(Root Entry|\x01CompObj|\x05SummaryInformation|\x05DocumentSummaryInformation)$/i.test(name)) continue;
      if (/(Pictures|Image|ObjectPool|VBA|MBD|ExOleObj|OlePres|Ctls|ObjInfo)/i.test(name)) continue;
      if (content.length > 25 * 1024 * 1024) continue;

      const priority = /PowerPoint Document/i.test(name) ? 100 : /Current User|Pictures/i.test(name) ? 20 : 10;
      streams.push({ name, content, priority });
    }
  } catch {
    streams.push({ name: "raw-file", content: buffer, priority: 0 });
  }

  if (!streams.length) streams.push({ name: "raw-file", content: buffer, priority: 0 });
  return streams.sort((a, b) => b.priority - a.priority).slice(0, 8);
}

async function tryExtractEmbeddedPptxText(buffer: Buffer, fileName: string) {
  // Unele .ppt salvate din versiuni noi conțin fragmente ZIP/PPTX interne. Încercăm să le citim dacă găsim un pachet complet.
  const zipOffsets: number[] = [];
  for (let index = 0; index < buffer.length - 4; index += 1) {
    if (buffer[index] === 0x50 && buffer[index + 1] === 0x4b && buffer[index + 2] === 0x03 && buffer[index + 3] === 0x04) {
      zipOffsets.push(index);
      if (zipOffsets.length >= 8) break;
    }
  }

  for (const offset of zipOffsets) {
    try {
      const maybeZip = buffer.subarray(offset);
      const zip = await JSZip.loadAsync(maybeZip);
      const hasSlides = Object.keys(zip.files).some((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
      if (hasSlides) return await parsePptxBuffer(maybeZip, fileName);
    } catch {
      // ignorăm offseturile care nu sunt un ZIP complet
    }
  }

  return null;
}

async function parsePptBuffer(buffer: Buffer, fileName: string) {
  if (isLikelyZipPackage(buffer)) return await parsePptxBuffer(buffer, fileName);

  const { songNumber, title } = inferNumberAndTitle(fileName);
  const convertedPptx = await convertLegacyPptToPptxBuffer(buffer, fileName);
  const parsed = await parsePptxBuffer(convertedPptx, `${stripExtension(fileName)}.pptx`);

  return {
    title,
    songNumber,
    text: parsed.text,
    note: `Import automat din PPT vechi: fișierul a fost convertit temporar în PPTX cu LibreOffice local, apoi textul a fost extras din slide-uri. Fișierele temporare au fost șterse. ${parsed.note}`
  };
}
async function parsePdfBuffer(buffer: Buffer, fileName: string) {
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule.default ?? pdfParseModule) as any;
    const result = await pdfParse(buffer);
    const text = normalizeExtractedText(result.text || "");
    if (!text) throw new Error("PDF-ul nu conține text selectabil.");
    return {
      text,
      note: `Import automat din PDF: ${result.numpages || "?"} pagini citite. Dacă PDF-ul este scanat, va fi nevoie de OCR separat.`
    };
  } catch (error: any) {
    throw new Error(`Nu am putut extrage text din ${fileName}: ${error.message || String(error)}`);
  }
}

async function parsePlainTextBuffer(buffer: Buffer) {
  return normalizeExtractedText(buffer.toString("utf8"));
}

function failedParsedImport(fileName: string, fileType: ParsedImport["fileType"], message: string, storagePath?: string | null): ParsedImport {
  const inferred = inferNumberAndTitle(fileName.split("/").pop() || fileName);
  return {
    fileName,
    fileType,
    title: inferred.title || fileName,
    songNumber: inferred.songNumber,
    lyricsText: "",
    parserNotes: `IMPORT EȘUAT: ${message}`,
    storagePath
  };
}

async function parseSingleFile(file: File, storagePath?: string | null, storageWarning?: string | null): Promise<ParsedImport[]> {
  if (!file.name) throw new Error("Unul dintre fișiere nu are nume valid.");
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error(`${file.name} depășește limita de 100 MB.`);

  const extension = getExtension(file.name);
  if (!supportedFileExtensions.has(extension)) {
    throw new Error(`Format neacceptat pentru ${file.name}. Folosește TXT, PPT, PPTX, PDF sau ZIP.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const inferred = inferNumberAndTitle(file.name);
  const baseNote = storageWarning ? `${storageWarning} ` : "";

  if (extension === "pptx") {
    const parsed = await parsePptxBuffer(buffer, file.name);
    return [{
      fileName: file.name,
      fileType: "pptx",
      title: inferred.title,
      songNumber: inferred.songNumber,
      lyricsText: parsed.text,
      parserNotes: `${baseNote}${parsed.note}`.trim(),
      storagePath
    }];
  }

  if (extension === "ppt") {
    const parsed = await parsePptBuffer(buffer, file.name);
    return [{
      fileName: file.name,
      fileType: "ppt",
      title: inferred.title,
      songNumber: inferred.songNumber,
      lyricsText: parsed.text,
      parserNotes: `${baseNote}${parsed.note}`.trim(),
      storagePath
    }];
  }

  if (extension === "pdf") {
    const parsed = await parsePdfBuffer(buffer, file.name);
    return [{
      fileName: file.name,
      fileType: "pdf",
      title: inferred.title,
      songNumber: inferred.songNumber,
      lyricsText: parsed.text,
      parserNotes: `${baseNote}${parsed.note}`.trim(),
      storagePath
    }];
  }

  if (extension === "zip") {
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.values(zip.files)
      .filter((entry) => !entry.dir && supportedFileExtensions.has(getExtension(entry.name)) && getExtension(entry.name) !== "zip")
      .sort((a, b) => a.name.localeCompare(b.name, "ro"));

    if (entries.length === 0) throw new Error(`${file.name} nu conține fișiere TXT/PPT/PPTX/PDF.`);

    const parsedEntries: ParsedImport[] = [];
    for (const entry of entries) {
      const entryExtension = getExtension(entry.name);
      const entryStoragePath = storagePath ? `${storagePath}#${entry.name}` : undefined;

      try {
        const entryBuffer = Buffer.from(await entry.async("uint8array"));
        const entryInferred = inferNumberAndTitle(entry.name.split("/").pop() || entry.name);

        if (entryExtension === "pptx") {
          const parsed = await parsePptxBuffer(entryBuffer, entry.name);
          parsedEntries.push({
            fileName: entry.name,
            fileType: "pptx",
            title: entryInferred.title,
            songNumber: entryInferred.songNumber,
            lyricsText: parsed.text,
            parserNotes: `${baseNote}Import din arhiva ${file.name}. ${parsed.note}`.trim(),
            storagePath: entryStoragePath
          });
        } else if (entryExtension === "ppt") {
          const parsed = await parsePptBuffer(entryBuffer, entry.name);
          parsedEntries.push({
            fileName: entry.name,
            fileType: "ppt",
            title: entryInferred.title,
            songNumber: entryInferred.songNumber,
            lyricsText: parsed.text,
            parserNotes: `${baseNote}Import din arhiva ${file.name}. ${parsed.note}`.trim(),
            storagePath: entryStoragePath
          });
        } else if (entryExtension === "pdf") {
          const parsed = await parsePdfBuffer(entryBuffer, entry.name);
          parsedEntries.push({
            fileName: entry.name,
            fileType: "pdf",
            title: entryInferred.title,
            songNumber: entryInferred.songNumber,
            lyricsText: parsed.text,
            parserNotes: `${baseNote}Import din arhiva ${file.name}. ${parsed.note}`.trim(),
            storagePath: entryStoragePath
          });
        } else {
          parsedEntries.push({
            fileName: entry.name,
            fileType: "txt",
            title: entryInferred.title,
            songNumber: entryInferred.songNumber,
            lyricsText: await parsePlainTextBuffer(entryBuffer),
            parserNotes: `${baseNote}Import din arhiva ${file.name}; text simplu extras automat.`.trim(),
            storagePath: entryStoragePath
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Nu am putut procesa fișierul.");
        parsedEntries.push(failedParsedImport(
          entry.name,
          entryExtension === "ppt" ? "ppt" : entryExtension === "pptx" ? "pptx" : entryExtension === "pdf" ? "pdf" : "txt",
          `Nu am putut importa acest fișier din arhiva ${file.name}. ${message}`,
          entryStoragePath
        ));
      }
    }
    return parsedEntries;
  }

  const text = await parsePlainTextBuffer(buffer);
  return [{
    fileName: file.name,
    fileType: "txt",
    title: inferred.title,
    songNumber: inferred.songNumber,
    lyricsText: text,
    parserNotes: `${baseNote}Import automat din text simplu. Verifică împărțirea pe secțiuni.`.trim(),
    storagePath
  }];
}

async function createSongFromParsedImport(parsed: ParsedImport, collectionId: string, formData: FormData, overrides?: { title?: string | null; songNumber?: string | null }) {
  const supabase = await createClient();
  const title = overrides?.title || parsed.title;
  const songNumber = overrides?.songNumber ?? parsed.songNumber;
  const bpm = readNullableInteger(formData, "bpm");
  const cleanLyrics = removeRepeatedTitleLines(parsed.lyricsText, title, songNumber);
  const sections = parseSections(parsed.lyricsText, title, songNumber);

  if (!title) throw new Error(`Nu am putut identifica titlul pentru ${parsed.fileName}.`);
  if (!cleanLyrics) throw new Error(`Nu am extras text din ${parsed.fileName}.`);
  if (bpm !== null && (bpm < 30 || bpm > 260)) throw new Error("BPM trebuie să fie între 30 și 260.");

  const { data: songId, error } = await supabase.rpc("import_song_with_sections", {
    p_collection_id: collectionId,
    p_title: title,
    p_song_number: songNumber,
    p_lyrics_text: cleanLyrics,
    p_sections: sections,
    p_file_name: parsed.fileName,
    p_file_type: allowedSourceTypes.has(parsed.fileType) ? parsed.fileType : "other",
    p_parser_notes: parsed.parserNotes,
    p_default_key: readNullableString(formData, "default_key"),
    p_bpm: bpm,
    p_structure: readNullableString(formData, "structure"),
    p_notes: readNullableString(formData, "notes"),
    p_storage_path: parsed.storagePath || null
  });

  if (error) throw new Error(error.message);
  if (!songId) throw new Error("Importul nu a returnat ID-ul cântării create.");

  return songId as string;
}

export async function importTextSongAction(formData: FormData) {
  const title = readString(formData, "title");
  const lyricsText = readString(formData, "lyrics_text");
  const sourceType = readString(formData, "source_type") || "txt";
  const songNumber = readNullableString(formData, "song_number");

  if (!title) throw new Error("Titlul cântării este obligatoriu.");
  if (!lyricsText) throw new Error("Textul cântării este obligatoriu.");
  if (!allowedSourceTypes.has(sourceType)) throw new Error("Tipul sursei nu este valid.");

  const collectionId = await resolveCollectionId(formData, sourceType);
  const parsed: ParsedImport = {
    fileName: `${songNumber ? `${songNumber} - ` : ""}${title}.txt`,
    fileType: sourceType === "manual" ? "txt" : (sourceType as any),
    title,
    songNumber,
    lyricsText,
    parserNotes: "Import manual din text. Verifică împărțirea pe secțiuni.",
    storagePath: null
  };
  const createdSongId = await createSongFromParsedImport(parsed, collectionId, formData, { title, songNumber });

  revalidatePath("/dashboard");
  revalidatePath("/songs");
  revalidatePath("/review");
  revalidatePath("/collections");
  redirect(`/songs/${createdSongId}/lyrics`);
}


async function getCollectionName(collectionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("song_collections")
    .select("name")
    .eq("id", collectionId)
    .maybeSingle();
  return data?.name || "Colecție import";
}

async function findDuplicateCandidates(parsedImports: ParsedImport[], collectionId: string) {
  const supabase = await createClient();
  const duplicateMap: Record<number, ImportDuplicateCandidate[]> = {};
  const numbers = Array.from(new Set(parsedImports.map((item) => item.songNumber).filter(Boolean))) as string[];

  if (numbers.length > 0) {
    const { data: sources } = await supabase
      .from("song_sources")
      .select("song_id,song_number,source_title,collection_id,songs(id,title),song_collections(name)")
      .eq("collection_id", collectionId)
      .in("song_number", numbers);

    for (const source of (sources || []) as any[]) {
      parsedImports.forEach((item, index) => {
        if (!item.songNumber || String(source.song_number || "") !== String(item.songNumber)) return;
        const song = Array.isArray(source.songs) ? source.songs[0] : source.songs;
        const collection = Array.isArray(source.song_collections) ? source.song_collections[0] : source.song_collections;
        if (!song?.id) return;
        duplicateMap[index] = duplicateMap[index] || [];
        duplicateMap[index].push({
          songId: song.id,
          title: song.title || source.source_title || "Cântare existentă",
          songNumber: source.song_number || null,
          collectionName: collection?.name || null,
          reason: `același număr în colecție: ${source.song_number}`
        });
      });
    }
  }

  const { data: songs } = await supabase
    .from("songs")
    .select("id,title")
    .eq("is_active", true)
    .limit(5000);

  const existingByLooseTitle = new Map<string, any[]>();
  for (const song of (songs || []) as any[]) {
    const key = normalizeForLooseCompare(song.title || "");
    if (!key) continue;
    const list = existingByLooseTitle.get(key) || [];
    list.push(song);
    existingByLooseTitle.set(key, list);
  }

  parsedImports.forEach((item, index) => {
    const key = normalizeForLooseCompare(item.title || "");
    const matches = key ? (existingByLooseTitle.get(key) || []) : [];
    for (const song of matches) {
      const alreadyListed = (duplicateMap[index] || []).some((candidate) => candidate.songId === song.id);
      if (alreadyListed) continue;
      duplicateMap[index] = duplicateMap[index] || [];
      duplicateMap[index].push({
        songId: song.id,
        title: song.title,
        songNumber: null,
        collectionName: null,
        reason: "titlu foarte asemănător / identic"
      });
    }
  });

  return duplicateMap;
}

function getParsedImportIssues(item: ParsedImport) {
  const issues: string[] = [];
  const parserNotes = String(item.parserNotes || "").trim();
  if (parserNotes.startsWith("IMPORT EȘUAT:")) {
    issues.push(parserNotes.replace(/^IMPORT EȘUAT:\s*/i, ""));
  }
  if (!String(item.title || "").trim()) {
    issues.push(`Nu am putut identifica titlul pentru ${item.fileName}.`);
  }
  if (!String(item.lyricsText || "").trim()) {
    issues.push(`Nu am extras text din ${item.fileName}.`);
  }
  return Array.from(new Set(issues));
}

function importMetadataFromForm(formData: FormData) {
  const bpm = readNullableInteger(formData, "bpm");
  if (bpm !== null && (bpm < 30 || bpm > 260)) throw new Error("BPM trebuie să fie între 30 și 260.");
  return {
    defaultKey: readNullableString(formData, "default_key"),
    bpm,
    structure: readNullableString(formData, "structure"),
    notes: readNullableString(formData, "notes")
  };
}

function metadataToFormData(metadata: ImportPreviewResult["metadata"]) {
  const formData = new FormData();
  if (metadata.defaultKey) formData.set("default_key", metadata.defaultKey);
  if (metadata.bpm !== null && metadata.bpm !== undefined) formData.set("bpm", String(metadata.bpm));
  if (metadata.structure) formData.set("structure", metadata.structure);
  if (metadata.notes) formData.set("notes", metadata.notes);
  return formData;
}

export async function previewSongFilesImportAction(formData: FormData): Promise<ImportPreviewResult> {
  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) throw new Error("Alege cel puțin un fișier TXT, PPT, PPTX, PDF sau ZIP.");
  if (files.length > 50) throw new Error("Importă maximum 50 de fișiere/arhive odată. Pentru 500 de cântări, pune-le într-un ZIP.");

  const titleOverride = readNullableString(formData, "title_override");
  const numberOverride = readNullableString(formData, "song_number_override");
  if (files.length > 1 && titleOverride) throw new Error("Titlul manual poate fi folosit doar când imporți un singur fișier.");

  const collectionId = await resolveCollectionId(formData, "pptx");
  const collectionName = await getCollectionName(collectionId);
  const parsedImports: ParsedImport[] = [];

  for (const file of files) {
    const { storagePath, warning } = await uploadOriginalFile(file, collectionId);
    try {
      const parsed = await parseSingleFile(file, storagePath, warning);
      parsedImports.push(...parsed);
    } catch (error) {
      const extension = getExtension(file.name);
      const message = error instanceof Error ? error.message : String(error || "Nu am putut procesa fișierul.");
      parsedImports.push(failedParsedImport(
        file.name,
        extension === "ppt" ? "ppt" : extension === "pptx" ? "pptx" : extension === "pdf" ? "pdf" : extension === "zip" ? "zip" : "txt",
        message,
        storagePath
      ));
    }
  }

  if (parsedImports.length === 0) throw new Error("Nu am extras nicio cântare din fișierele selectate.");

  if (parsedImports.length === 1) {
    if (titleOverride) parsedImports[0].title = titleOverride;
    if (numberOverride !== null) parsedImports[0].songNumber = numberOverride;
  }

  const duplicates = await findDuplicateCandidates(parsedImports, collectionId);
  const items = parsedImports.map((item, index) => {
    const importIssues = getParsedImportIssues(item);
    return {
      ...item,
      previewId: crypto.randomUUID(),
      duplicates: duplicates[index] || [],
      importIssues,
      canImport: importIssues.length === 0
    };
  });

  return {
    collectionId,
    collectionName,
    items,
    duplicateCount: items.filter((item) => item.duplicates.length > 0).length,
    metadata: importMetadataFromForm(formData)
  };
}

async function overwriteSongFromParsedImport(parsed: ParsedImport, collectionId: string, metadata: ImportPreviewResult["metadata"], targetSongId: string) {
  const supabase = await createClient();
  const title = parsed.title;
  const cleanLyrics = removeRepeatedTitleLines(parsed.lyricsText, title, parsed.songNumber);
  const sections = parseSections(parsed.lyricsText, title, parsed.songNumber);

  if (!title) throw new Error(`Nu am putut identifica titlul pentru ${parsed.fileName}.`);
  if (!cleanLyrics) throw new Error(`Nu am extras text din ${parsed.fileName}.`);

  const { data: songId, error } = await supabase.rpc("overwrite_song_with_sections", {
    p_song_id: targetSongId,
    p_collection_id: collectionId,
    p_title: title,
    p_song_number: parsed.songNumber,
    p_lyrics_text: cleanLyrics,
    p_sections: sections,
    p_file_name: parsed.fileName,
    p_file_type: allowedSourceTypes.has(parsed.fileType) ? parsed.fileType : "other",
    p_parser_notes: `${parsed.parserNotes} Importul a suprascris o cântare existentă.`.trim(),
    p_default_key: metadata.defaultKey,
    p_bpm: metadata.bpm,
    p_structure: metadata.structure,
    p_notes: metadata.notes,
    p_storage_path: parsed.storagePath || null
  });

  if (error) throw new Error(error.message);
  return (songId || targetSongId) as string;
}

export async function confirmSongFilesImportBatchAction(input: {
  collectionId: string;
  metadata: ImportPreviewResult["metadata"];
  items: ImportPreviewItem[];
  decisions: Record<string, string>;
  targets: Record<string, string>;
}): Promise<ConfirmImportBatchResult> {
  if (!input.collectionId || !Array.isArray(input.items)) {
    throw new Error("Datele lotului de import nu sunt valide.");
  }

  const createdOrUpdatedIds: string[] = [];
  const errors: ConfirmImportBatchError[] = [];
  let skipped = 0;

  for (const item of input.items) {
    const previewId = item.previewId;
    const decision = input.decisions?.[previewId] || (item.duplicates.length > 0 ? "skip" : "create");

    if (decision === "skip") {
      skipped += 1;
      continue;
    }

    const importIssues = getParsedImportIssues(item);
    if (importIssues.length > 0) {
      skipped += 1;
      errors.push({
        previewId,
        fileName: item.fileName,
        title: item.title || item.fileName,
        message: importIssues.join(" ")
      });
      continue;
    }

    try {
      if (decision === "overwrite") {
        const targetSongId = input.targets?.[previewId] || item.duplicates[0]?.songId;
        if (!targetSongId) {
          skipped += 1;
          errors.push({
            previewId,
            fileName: item.fileName,
            title: item.title || item.fileName,
            message: "Nu am găsit cântarea țintă pentru suprascriere."
          });
          continue;
        }
        createdOrUpdatedIds.push(await overwriteSongFromParsedImport(item, input.collectionId, input.metadata, targetSongId));
        continue;
      }

      const createdSongId = await createSongFromParsedImport(item, input.collectionId, metadataToFormData(input.metadata), {
        title: item.title,
        songNumber: item.songNumber
      });

      createdOrUpdatedIds.push(createdSongId);
    } catch (err) {
      skipped += 1;
      errors.push({
        previewId,
        fileName: item.fileName,
        title: item.title || item.fileName,
        message: err instanceof Error ? err.message : "Nu am putut importa această cântare."
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/songs");
  revalidatePath("/review");
  revalidatePath("/collections");

  return {
    processed: input.items.length,
    createdOrUpdatedIds,
    skipped,
    errors
  };
}

export async function confirmSongFilesImportAction(formData: FormData) {
  const rawPayload = readString(formData, "preview_payload");
  if (!rawPayload) throw new Error("Lipsește analiza importului. Reîncarcă pagina și încearcă din nou.");

  const payload = JSON.parse(rawPayload) as ImportPreviewResult;
  if (!payload.collectionId || !Array.isArray(payload.items)) throw new Error("Datele importului nu sunt valide.");

  const createdOrUpdatedIds: string[] = [];
  let skipped = 0;

  for (const item of payload.items) {
    const decision = readString(formData, `decision_${item.previewId}`) || (item.duplicates.length > 0 ? "skip" : "create");
    if (decision === "skip") {
      skipped += 1;
      continue;
    }

    if (getParsedImportIssues(item).length > 0) {
      skipped += 1;
      continue;
    }

    if (decision === "overwrite") {
      const targetSongId = readString(formData, `target_${item.previewId}`) || item.duplicates[0]?.songId;
      if (!targetSongId) {
        skipped += 1;
        continue;
      }
      createdOrUpdatedIds.push(await overwriteSongFromParsedImport(item, payload.collectionId, payload.metadata, targetSongId));
      continue;
    }

    const createdSongId = await createSongFromParsedImport(item, payload.collectionId, metadataToFormData(payload.metadata), {
      title: item.title,
      songNumber: item.songNumber
    });

    createdOrUpdatedIds.push(createdSongId);
  }

  revalidatePath("/dashboard");
  revalidatePath("/songs");
  revalidatePath("/review");
  revalidatePath("/collections");

  if (createdOrUpdatedIds.length === 1 && skipped === 0) redirect(`/songs/${createdOrUpdatedIds[0]}/lyrics`);
  redirect(`/review?status=needs_review&imported=${createdOrUpdatedIds.length}&skipped=${skipped}`);
}

export async function importSongFilesAction(formData: FormData) {
  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) throw new Error("Alege cel puțin un fișier TXT, PPT, PPTX, PDF sau ZIP.");
  if (files.length > 50) throw new Error("Importă maximum 50 de fișiere odată.");

  const titleOverride = readNullableString(formData, "title_override");
  const numberOverride = readNullableString(formData, "song_number_override");
  if (files.length > 1 && titleOverride) throw new Error("Titlul manual poate fi folosit doar când imporți un singur fișier.");

  const collectionId = await resolveCollectionId(formData, "pptx");
  const parsedImports: ParsedImport[] = [];

  for (const file of files) {
    const { storagePath, warning } = await uploadOriginalFile(file, collectionId);
    try {
      const parsed = await parseSingleFile(file, storagePath, warning);
      parsedImports.push(...parsed);
    } catch (error) {
      const extension = getExtension(file.name);
      const message = error instanceof Error ? error.message : String(error || "Nu am putut procesa fișierul.");
      parsedImports.push(failedParsedImport(
        file.name,
        extension === "ppt" ? "ppt" : extension === "pptx" ? "pptx" : extension === "pdf" ? "pdf" : extension === "zip" ? "zip" : "txt",
        message,
        storagePath
      ));
    }
  }

  if (parsedImports.length === 0) throw new Error("Nu am extras nicio cântare din fișierele selectate.");

  const createdSongIds: string[] = [];
  let skipped = 0;
  for (const parsed of parsedImports) {
    if (getParsedImportIssues(parsed).length > 0) {
      skipped += 1;
      continue;
    }

    try {
      const createdSongId = await createSongFromParsedImport(parsed, collectionId, formData, {
        title: parsedImports.length === 1 ? titleOverride : undefined,
        songNumber: parsedImports.length === 1 ? (numberOverride ?? parsed.songNumber) : parsed.songNumber
      });
      createdSongIds.push(createdSongId);
    } catch {
      skipped += 1;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/songs");
  revalidatePath("/review");
  revalidatePath("/collections");

  if (createdSongIds.length === 1 && skipped === 0) redirect(`/songs/${createdSongIds[0]}/lyrics`);
  redirect(`/review?status=needs_review&imported=${createdSongIds.length}&skipped=${skipped}`);
}
