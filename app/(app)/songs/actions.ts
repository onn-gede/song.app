"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildStableBibleSourceUrl, getLocalFreeBibleText } from "@/lib/freeBibleText";
import { stripRepeatedSongTitleLines } from "@/lib/songTextCleanup";

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

export async function updateSongMetadataAction(formData: FormData) {
  const songId = readString(formData, "song_id");
  const title = readString(formData, "title");
  const categoryIds = formData
    .getAll("category_ids")
    .map((value) => String(value))
    .filter(Boolean);

  if (!songId) throw new Error("Lipsește ID-ul cântării.");
  if (!title) throw new Error("Titlul cântării este obligatoriu.");

  const bpm = readNullableInteger(formData, "bpm");
  if (bpm !== null && (bpm < 30 || bpm > 260)) {
    throw new Error("BPM trebuie să fie între 30 și 260.");
  }

  const supabase = await createClient();

  // Folosim update direct, nu RPC, ca să evităm problemele de PostgREST schema cache
  // când adăugăm/înlocuim funcții SQL în timpul dezvoltării.
  const { error: metadataError } = await supabase
    .from("songs")
    .update({
      title,
      default_key: readNullableString(formData, "default_key"),
      bpm,
      structure: readNullableString(formData, "structure"),
      notes: readNullableString(formData, "notes"),
    })
    .eq("id", songId);

  if (metadataError) throw new Error(metadataError.message);

  const { error: deleteError } = await supabase
    .from("song_categories")
    .delete()
    .eq("song_id", songId);

  if (deleteError) throw new Error(deleteError.message);

  if (categoryIds.length > 0) {
    const rows = categoryIds.map((categoryId) => ({
      song_id: songId,
      category_id: categoryId,
    }));

    const { error: insertError } = await supabase
      .from("song_categories")
      .insert(rows);

    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/songs");
  revalidatePath(`/songs/${songId}`);
  redirect(`/songs/${songId}`);
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function normalizeSectionType(value: string) {
  const allowed = new Set([
    "verse",
    "chorus",
    "bridge",
    "prechorus",
    "ending",
    "text",
  ]);
  return allowed.has(value) ? value : "verse";
}

export async function updateSongLyricsAction(formData: FormData) {
  const songId = readString(formData, "song_id");
  const title = readString(formData, "title");
  const structure = readNullableString(formData, "structure");
  const importStatus = readString(formData, "import_status") || "needs_review";
  const sectionsCount = Number.parseInt(
    readString(formData, "sections_count") || "0",
    10,
  );

  if (!songId) throw new Error("Lipsește ID-ul cântării.");
  if (!title) throw new Error("Titlul cântării este obligatoriu.");
  if (!Number.isFinite(sectionsCount) || sectionsCount < 1)
    throw new Error("Nu există secțiuni de salvat.");

  const sections = [] as Array<{
    song_id: string;
    section_type: string;
    section_label: string | null;
    position: number;
    content: string;
  }>;

  for (let index = 0; index < sectionsCount; index += 1) {
    const content = stripRepeatedSongTitleLines(readString(formData, `section_content_${index}`), title);
    if (!content) continue;

    sections.push({
      song_id: songId,
      section_type: normalizeSectionType(
        readString(formData, `section_type_${index}`),
      ),
      section_label: readNullableString(formData, `section_label_${index}`),
      position: sections.length + 1,
      content,
    });
  }

  if (sections.length === 0)
    throw new Error("Trebuie să existe cel puțin o secțiune cu text.");

  const lyricsText = sections.map((section) => section.content).join("\n\n");
  const supabase = await createClient();

  const { error: songError } = await supabase
    .from("songs")
    .update({
      title,
      structure,
      lyrics_text: lyricsText,
    })
    .eq("id", songId);

  if (songError) throw new Error(songError.message);

  const { error: deleteSectionsError } = await supabase
    .from("song_sections")
    .delete()
    .eq("song_id", songId);

  if (deleteSectionsError) throw new Error(deleteSectionsError.message);

  const { error: insertSectionsError } = await supabase
    .from("song_sections")
    .insert(sections);

  if (insertSectionsError) throw new Error(insertSectionsError.message);

  const allowedStatuses = new Set([
    "pending",
    "parsed",
    "needs_review",
    "approved",
    "failed",
  ]);
  if (allowedStatuses.has(importStatus)) {
    const { error: fileError } = await supabase
      .from("song_files")
      .update({ import_status: importStatus })
      .eq("song_id", songId);

    if (fileError) throw new Error(fileError.message);
  }

  if (readBoolean(formData, "go_back_to_review")) {
    revalidatePath("/review");
    redirect("/review");
  }

  revalidatePath("/dashboard");
  revalidatePath("/review");
  revalidatePath("/songs");
  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/songs/${songId}/lyrics`);
  redirect(`/songs/${songId}`);
}

function buildReferenceLabel(
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd: number | null,
) {
  const range =
    verseEnd && verseEnd !== verseStart
      ? `${verseStart}-${verseEnd}`
      : `${verseStart}`;
  return `${book} ${chapter}:${range}`;
}

const RESURSE_CRESTINE_BOOK_SLUGS: Record<string, string> = {
  geneza: "geneza",
  exodul: "exodul",
  leviticul: "leviticul",
  numeri: "numeri",
  deuteronomul: "deuteronomul",
  iosua: "iosua",
  judecatorii: "judecatorii",
  rut: "rut",
  "1 samuel": "1-samuel",
  "2 samuel": "2-samuel",
  "1 imparati": "1-imparati",
  "1 împărați": "1-imparati",
  "2 imparati": "2-imparati",
  "2 împărați": "2-imparati",
  "1 cronici": "1-cronici",
  "2 cronici": "2-cronici",
  ezra: "ezra",
  neemia: "neemia",
  estera: "estera",
  iov: "iov",
  psalmii: "psalmii",
  psalmul: "psalmii",
  proverbele: "proverbele",
  eclesiastul: "eclesiastul",
  "cantarea cantarilor": "cantarea-cantarilor",
  "cântarea cântărilor": "cantarea-cantarilor",
  isaia: "isaia",
  ieremia: "ieremia",
  "plangerile lui ieremia": "plangerile-lui-ieremia",
  "plângerile lui ieremia": "plangerile-lui-ieremia",
  ezechiel: "ezechiel",
  daniel: "daniel",
  osea: "osea",
  ioel: "ioel",
  amos: "amos",
  obadia: "obadia",
  iona: "iona",
  mica: "mica",
  naum: "naum",
  habacuc: "habacuc",
  tefania: "tefania",
  hagai: "hagai",
  zaharia: "zaharia",
  maleahi: "maleahi",
  matei: "matei",
  marcu: "marcu",
  luca: "luca",
  ioan: "ioan",
  "faptele apostolilor": "faptele-apostolilor",
  fapte: "faptele-apostolilor",
  romani: "romani",
  "1 corinteni": "1-corinteni",
  "2 corinteni": "2-corinteni",
  galateni: "galateni",
  efeseni: "efeseni",
  filipeni: "filipeni",
  coloseni: "coloseni",
  "1 tesaloniceni": "1-tesaloniceni",
  "2 tesaloniceni": "2-tesaloniceni",
  "1 timotei": "1-timotei",
  "2 timotei": "2-timotei",
  tit: "tit",
  filimon: "filimon",
  evrei: "evrei",
  iacov: "iacov",
  "1 petru": "1-petru",
  "2 petru": "2-petru",
  "1 ioan": "1-ioan",
  "2 ioan": "2-ioan",
  "3 ioan": "3-ioan",
  iuda: "iuda",
  apocalipsa: "apocalipsa",
};

function normalizeBookName(book: string) {
  return book
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ş/g, "s")
    .replace(/ţ/g, "t")
    .replace(/ă/g, "a")
    .replace(/î/g, "i")
    .replace(/â/g, "a")
    .replace(/\s+/g, " ")
    .trim();
}

function bookSlug(book: string) {
  const normalized = normalizeBookName(book);
  return RESURSE_CRESTINE_BOOK_SLUGS[book.toLowerCase().trim()] ||
    RESURSE_CRESTINE_BOOK_SLUGS[normalized] ||
    normalized.replace(/\s+/g, "-");
}


const BIBLE_API_BOOK_NAMES: Record<string, string> = {
  geneza: "Genesis",
  exodul: "Exodus",
  leviticul: "Leviticus",
  numeri: "Numbers",
  deuteronomul: "Deuteronomy",
  iosua: "Joshua",
  judecatorii: "Judges",
  judecatori: "Judges",
  rut: "Ruth",
  "1 samuel": "1 Samuel",
  "2 samuel": "2 Samuel",
  "1 imparati": "1 Kings",
  "1 împărați": "1 Kings",
  "2 imparati": "2 Kings",
  "2 împărați": "2 Kings",
  "1 cronici": "1 Chronicles",
  "2 cronici": "2 Chronicles",
  ezra: "Ezra",
  neemia: "Nehemiah",
  estera: "Esther",
  iov: "Job",
  psalmii: "Psalms",
  psalmul: "Psalms",
  psalmi: "Psalms",
  proverbele: "Proverbs",
  proverbe: "Proverbs",
  eclesiastul: "Ecclesiastes",
  "cantarea cantarilor": "Song of Solomon",
  "cântarea cântărilor": "Song of Solomon",
  isaia: "Isaiah",
  ieremia: "Jeremiah",
  "plangerile lui ieremia": "Lamentations",
  "plângerile lui ieremia": "Lamentations",
  ezechiel: "Ezekiel",
  daniel: "Daniel",
  osea: "Hosea",
  ioel: "Joel",
  amos: "Amos",
  obadia: "Obadiah",
  iona: "Jonah",
  mica: "Micah",
  naum: "Nahum",
  habacuc: "Habakkuk",
  tefania: "Zephaniah",
  hagai: "Haggai",
  zaharia: "Zechariah",
  maleahi: "Malachi",
  matei: "Matthew",
  marcu: "Mark",
  luca: "Luke",
  ioan: "John",
  "faptele apostolilor": "Acts",
  fapte: "Acts",
  romani: "Romans",
  "1 corinteni": "1 Corinthians",
  "2 corinteni": "2 Corinthians",
  galateni: "Galatians",
  efeseni: "Ephesians",
  filipeni: "Philippians",
  coloseni: "Colossians",
  "1 tesaloniceni": "1 Thessalonians",
  "2 tesaloniceni": "2 Thessalonians",
  "1 timotei": "1 Timothy",
  "2 timotei": "2 Timothy",
  tit: "Titus",
  filimon: "Philemon",
  evrei: "Hebrews",
  iacov: "James",
  "1 petru": "1 Peter",
  "2 petru": "2 Peter",
  "1 ioan": "1 John",
  "2 ioan": "2 John",
  "3 ioan": "3 John",
  iuda: "Jude",
  apocalipsa: "Revelation",
};

function bibleApiBookName(book: string) {
  const normalized = normalizeBookName(book);
  return BIBLE_API_BOOK_NAMES[book.toLowerCase().trim()] || BIBLE_API_BOOK_NAMES[normalized] || book;
}

function buildBibleApiUrl(book: string, chapter: number, verseStart: number, verseEnd: number | null, translation = "rccv", useOriginalBookName = false) {
  const range = verseEnd && verseEnd !== verseStart ? `${verseStart}-${verseEnd}` : `${verseStart}`;
  const bookName = useOriginalBookName ? book : bibleApiBookName(book);
  const reference = `${bookName} ${chapter}:${range}`;
  return `https://bible-api.com/${encodeURIComponent(reference)}?translation=${encodeURIComponent(translation)}`;
}

async function fetchBibleTextFromFreeBibleApi(book: string, chapter: number, verseStart: number, verseEnd: number | null) {
  const local = getLocalFreeBibleText(book, chapter, verseStart, verseEnd);
  if (local) {
    return { text: local.text, url: local.sourceUrl, version: local.version, copyrightNotes: local.copyrightNotes };
  }

  // Nu mai apelăm automat API-uri externe pentru fiecare sugestie, deoarece pot returna 403/429
  // și pot bloca fluxul de lucru. Pentru referințe care nu sunt încă în fallback-ul local,
  // utilizatorul poate salva referința și completa textul manual.
  throw new Error("Nu există încă text local gratuit pentru această referință. Salvează referința și completează textul manual, sau adaug-o în biblioteca locală de versete.");
}


export async function getBibleTextPreviewForSuggestionAction(input: {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number | null;
}) {
  try {
    const chapter = Math.trunc(Number(input.chapter));
    const verseStart = Math.trunc(Number(input.verseStart));
    const verseEnd = input.verseEnd === null || typeof input.verseEnd === "undefined" ? null : Math.trunc(Number(input.verseEnd));

    if (!input.book?.trim() || chapter < 1 || verseStart < 1 || (verseEnd !== null && verseEnd < verseStart)) {
      return { ok: false as const, text: null, url: null, version: null, error: "Referință invalidă." };
    }

    const fetched = await fetchBibleTextFromFreeBibleApi(input.book.trim(), chapter, verseStart, verseEnd);
    return { ok: true as const, text: fetched.text, url: fetched.url, version: fetched.version, error: null };
  } catch (error) {
    return {
      ok: false as const,
      text: null,
      url: null,
      version: null,
      error: error instanceof Error ? error.message : "Nu am putut prelua textul versetului.",
    };
  }
}

function buildResurseCrestineUrl(book: string, chapter: number, verseStart?: number | null) {
  const slug = bookSlug(book);
  return `https://bible-api.com/${slug}/${chapter}${verseStart ? `#v${verseStart}` : ""}`;
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function plainTextFromHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p>|<\/li>|<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractVerseTextFromChapter(html: string, verseStart: number, verseEnd: number | null) {
  const text = plainTextFromHtml(html);
  const end = verseEnd || verseStart;
  const parts: string[] = [];

  for (let verse = verseStart; verse <= end; verse += 1) {
    const startToken = new RegExp(`(?:\\^\\{${verse}\\}|\\b${verse}\\s+)`);
    const startMatch = text.match(startToken);
    if (!startMatch || typeof startMatch.index !== "number") continue;

    const afterStart = text.slice(startMatch.index + startMatch[0].length);
    const nextMatch = afterStart.match(new RegExp(`(?:\\^\\{${verse + 1}\\}|\\b${verse + 1}\\s+)`));
    let verseText = (nextMatch && typeof nextMatch.index === "number" ? afterStart.slice(0, nextMatch.index) : afterStart).trim();

    // Resurse Creștine poate afișa același verset de două ori când notele/trimiterile sunt active.
    // Păstrăm prima propoziție completă când detectăm o dublare evidentă.
    const half = Math.floor(verseText.length / 2);
    const firstHalf = verseText.slice(0, half).trim();
    const secondHalf = verseText.slice(half).trim();
    if (firstHalf.length > 20 && secondHalf.startsWith(firstHalf.slice(0, 25))) {
      verseText = firstHalf;
    }

    verseText = verseText
      .replace(/\s+\*\s+.*$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (verseText) parts.push(`${verse}. ${verseText}`);
  }

  return parts.join("\n").trim();
}

async function fetchBibleTextFromResurseCrestine(book: string, chapter: number, verseStart: number, verseEnd: number | null) {
  const url = buildResurseCrestineUrl(book, chapter, null);
  const response = await fetch(url, {
    headers: {
      "user-agent": "SongApp local church planner",
      "accept": "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Nu am putut prelua textul din sursa stabilă (${response.status}).`);
  }

  const html = await response.text();
  const text = extractVerseTextFromChapter(html, verseStart, verseEnd);
  if (!text) throw new Error("Nu am găsit textul versetului în pagina sursă.");
  return { text, url };
}

export async function addSongBibleReferenceAction(formData: FormData) {
  const songId = readString(formData, "song_id");
  const book = readString(formData, "book");
  const chapter = readNullableInteger(formData, "chapter");
  const verseStart = readNullableInteger(formData, "verse_start");
  const verseEnd = readNullableInteger(formData, "verse_end");
  const referenceLabelManual = readNullableString(formData, "reference_label");
  const theme = readNullableString(formData, "theme");
  const reason = readNullableString(formData, "reason");
  const sourceUrlManual = readNullableString(formData, "source_url");
  const textCache = readNullableString(formData, "text_cache");
  const copyrightNotes = readNullableString(formData, "copyright_notes");

  if (!songId) throw new Error("Lipsește ID-ul cântării.");
  if (!book) throw new Error("Cartea biblică este obligatorie.");
  if (!chapter || chapter < 1)
    throw new Error("Capitolul trebuie să fie un număr valid.");
  if (!verseStart || verseStart < 1)
    throw new Error("Versetul de început trebuie să fie valid.");
  if (verseEnd !== null && verseEnd < verseStart)
    throw new Error(
      "Versetul final nu poate fi mai mic decât versetul de început.",
    );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const referenceLabel =
    referenceLabelManual ||
    buildReferenceLabel(book, chapter, verseStart, verseEnd);
  const sourceUrl =
    sourceUrlManual || buildStableBibleSourceUrl(book, chapter, verseStart, verseEnd);

  let finalTextCache = textCache;
  let finalCopyrightNotes = copyrightNotes;
  if (!finalTextCache && readBoolean(formData, "auto_fetch_text")) {
    try {
      const fetched = await fetchBibleTextFromFreeBibleApi(book, chapter, verseStart, verseEnd);
      finalTextCache = fetched.text;
      finalCopyrightNotes =
        finalCopyrightNotes ||
        fetched.copyrightNotes || `Text preluat din fallback local (${fetched.version}). Verifică textul înainte de folosire publică.`;
    } catch (error) {
      finalCopyrightNotes =
        finalCopyrightNotes ||
        `Nu am putut prelua automat textul: ${error instanceof Error ? error.message : "eroare necunoscută"}`;
    }
  }

  let referenceQuery = supabase
    .from("bible_references")
    .select("id")
    .eq("version", "RCCV - Protestant Romanian Corrected Cornilescu Version")
    .eq("book", book)
    .eq("chapter", chapter)
    .eq("verse_start", verseStart);

  referenceQuery =
    verseEnd === null
      ? referenceQuery.is("verse_end", null)
      : referenceQuery.eq("verse_end", verseEnd);

  const { data: existingReference, error: lookupError } =
    await referenceQuery.maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  let bibleReferenceId = existingReference?.id as string | undefined;

  if (!bibleReferenceId) {
    const { data: insertedReference, error: insertReferenceError } =
      await supabase
        .from("bible_references")
        .insert({
          version: "RCCV - Protestant Romanian Corrected Cornilescu Version",
          book,
          chapter,
          verse_start: verseStart,
          verse_end: verseEnd,
          reference_label: referenceLabel,
          text_cache: finalTextCache,
          source_url: sourceUrl,
          copyright_notes:
            finalCopyrightNotes ||
            "Referință salvată. Pentru text automat folosim fallback local Cornilescu 1921 pentru versetele cunoscute; altfel completează manual textul.",
        })
        .select("id")
        .single();

    if (insertReferenceError) throw new Error(insertReferenceError.message);
    bibleReferenceId = insertedReference.id;
  } else {
    const updatePayload: Record<string, string | null> = {
      reference_label: referenceLabel,
      source_url: sourceUrl,
      copyright_notes: finalCopyrightNotes,
    };
    if (finalTextCache !== null) updatePayload.text_cache = finalTextCache;

    const { error: updateReferenceError } = await supabase
      .from("bible_references")
      .update(updatePayload)
      .eq("id", bibleReferenceId);

    if (updateReferenceError) throw new Error(updateReferenceError.message);
  }

  const { error: relationError } = await supabase
    .from("song_bible_references")
    .upsert(
      {
        song_id: songId,
        bible_reference_id: bibleReferenceId,
        theme,
        reason,
        confidence: null,
        created_by: user?.id || null,
      },
      { onConflict: "song_id,bible_reference_id,theme" },
    );

  if (relationError) throw new Error(relationError.message);

  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/songs/${songId}/verses`);
  redirect(`/songs/${songId}/verses?saved=1`);
}

type SuggestedBibleReferenceInput = {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number | null;
  referenceLabel?: string;
  theme?: string | null;
  reason?: string | null;
  confidence?: number | null;
};

function isSuggestedBibleReferenceInput(
  value: unknown,
): value is SuggestedBibleReferenceInput {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.book === "string" &&
    typeof item.chapter === "number" &&
    typeof item.verseStart === "number"
  );
}

async function saveBibleReferenceForSong(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    songId: string;
    book: string;
    chapter: number;
    verseStart: number;
    verseEnd: number | null;
    referenceLabel?: string | null;
    theme?: string | null;
    reason?: string | null;
    confidence?: number | null;
    sourceUrl?: string | null;
    textCache?: string | null;
    copyrightNotes?: string | null;
    createdBy?: string | null;
  },
) {
  const referenceLabel =
    input.referenceLabel ||
    buildReferenceLabel(
      input.book,
      input.chapter,
      input.verseStart,
      input.verseEnd,
    );
  const sourceUrl =
    input.sourceUrl ||
    buildStableBibleSourceUrl(input.book, input.chapter, input.verseStart, input.verseEnd);

  let referenceQuery = supabase
    .from("bible_references")
    .select("id")
    .eq("version", "RCCV - Protestant Romanian Corrected Cornilescu Version")
    .eq("book", input.book)
    .eq("chapter", input.chapter)
    .eq("verse_start", input.verseStart);

  referenceQuery =
    input.verseEnd === null
      ? referenceQuery.is("verse_end", null)
      : referenceQuery.eq("verse_end", input.verseEnd);

  const { data: existingReference, error: lookupError } =
    await referenceQuery.maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  let bibleReferenceId = existingReference?.id as string | undefined;

  if (!bibleReferenceId) {
    const { data: insertedReference, error: insertReferenceError } =
      await supabase
        .from("bible_references")
        .insert({
          version: "RCCV - Protestant Romanian Corrected Cornilescu Version",
          book: input.book,
          chapter: input.chapter,
          verse_start: input.verseStart,
          verse_end: input.verseEnd,
          reference_label: referenceLabel,
          text_cache: input.textCache || null,
          source_url: sourceUrl,
          copyright_notes:
            input.copyrightNotes ||
            "Sugestie salvată ca referință biblică. Textul se poate completa manual sau din fallback-ul local Cornilescu 1921.",
        })
        .select("id")
        .single();

    if (insertReferenceError) throw new Error(insertReferenceError.message);
    bibleReferenceId = insertedReference.id;
  } else {
    const { error: updateReferenceError } = await supabase
      .from("bible_references")
      .update({
        reference_label: referenceLabel,
        source_url: sourceUrl,
        ...(input.textCache ? { text_cache: input.textCache } : {}),
        copyright_notes:
          input.copyrightNotes ||
          "Sugestie salvată ca referință biblică. Textul se poate completa manual sau din fallback-ul local Cornilescu 1921.",
      })
      .eq("id", bibleReferenceId);

    if (updateReferenceError) throw new Error(updateReferenceError.message);
  }

  const { error: relationError } = await supabase
    .from("song_bible_references")
    .upsert(
      {
        song_id: input.songId,
        bible_reference_id: bibleReferenceId,
        theme: input.theme || null,
        reason: input.reason || null,
        confidence: input.confidence ?? null,
        created_by: input.createdBy || null,
      },
      { onConflict: "song_id,bible_reference_id,theme" },
    );

  if (relationError) throw new Error(relationError.message);
}

export async function addSuggestedBibleReferencesAction(formData: FormData) {
  const songId = readString(formData, "song_id");
  const selectedRaw = formData
    .getAll("selected_suggestions")
    .map((value) => String(value));

  if (!songId) throw new Error("Lipsește ID-ul cântării.");
  if (selectedRaw.length === 0)
    throw new Error("Selectează cel puțin o sugestie de salvat.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let savedCount = 0;
  for (const raw of selectedRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    if (!isSuggestedBibleReferenceInput(parsed)) continue;
    const chapter = Math.trunc(parsed.chapter);
    const verseStart = Math.trunc(parsed.verseStart);
    const verseEnd =
      parsed.verseEnd === null || typeof parsed.verseEnd === "undefined"
        ? null
        : Math.trunc(Number(parsed.verseEnd));

    if (
      !parsed.book.trim() ||
      chapter < 1 ||
      verseStart < 1 ||
      (verseEnd !== null && verseEnd < verseStart)
    )
      continue;

    let fetchedText: string | null = null;
    let fetchedVersion: string | null = null;
    try {
      const fetched = await fetchBibleTextFromFreeBibleApi(parsed.book.trim(), chapter, verseStart, verseEnd);
      fetchedText = fetched.text;
      fetchedVersion = fetched.version;
    } catch {
      fetchedText = null;
      fetchedVersion = null;
    }

    await saveBibleReferenceForSong(supabase, {
      songId,
      book: parsed.book.trim(),
      chapter,
      verseStart,
      verseEnd,
      referenceLabel: parsed.referenceLabel || null,
      theme: parsed.theme || null,
      reason: parsed.reason || null,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : null,
      textCache: fetchedText,
      copyrightNotes: fetchedText
        ? `Text preluat din fallback local (${fetchedVersion || "Cornilescu 1921"}). Verifică textul înainte de folosire publică.`
        : null,
      createdBy: user?.id || null,
    });
    savedCount += 1;
  }

  if (savedCount === 0)
    throw new Error("Nu am putut salva sugestiile selectate.");

  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/songs/${songId}/verses`);
  redirect(`/songs/${songId}/verses?suggestions_saved=${savedCount}`);
}

export async function fetchBibleTextForReferenceAction(formData: FormData) {
  const songId = readString(formData, "song_id");
  const referenceId = readString(formData, "reference_id");

  if (!songId) throw new Error("Lipsește ID-ul cântării.");
  if (!referenceId) throw new Error("Lipsește ID-ul referinței biblice.");

  const supabase = await createClient();
  const { data: reference, error: referenceError } = await supabase
    .from("bible_references")
    .select("id,book,chapter,verse_start,verse_end")
    .eq("id", referenceId)
    .single();

  if (referenceError || !reference) throw new Error(referenceError?.message || "Nu am găsit referința biblică.");

  try {
    const fetched = await fetchBibleTextFromFreeBibleApi(
      reference.book,
      reference.chapter,
      reference.verse_start,
      reference.verse_end,
    );

    const { error: updateError } = await supabase
      .from("bible_references")
      .update({
        text_cache: fetched.text,
        source_url: fetched.url,
        copyright_notes: fetched.copyrightNotes || `Text preluat din fallback local (${fetched.version}). Verifică textul înainte de folosire publică.`,
      })
      .eq("id", referenceId);

    if (updateError) throw new Error(updateError.message);

    revalidatePath(`/songs/${songId}`);
    revalidatePath(`/songs/${songId}/verses`);
    redirect(`/songs/${songId}/verses?text_fetched=1`);
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : "Nu am putut prelua automat textul.");
    redirect(`/songs/${songId}/verses?text_error=${message}`);
  }
}


export async function fetchAllBibleTextsForSongAction(formData: FormData) {
  const songId = readString(formData, "song_id");
  if (!songId) throw new Error("Lipsește ID-ul cântării.");

  const supabase = await createClient();
  const { data: refs, error: refsError } = await supabase
    .from("song_bible_references")
    .select("bible_references(id,book,chapter,verse_start,verse_end,text_cache)")
    .eq("song_id", songId);

  if (refsError) throw new Error(refsError.message);

  let fetchedCount = 0;
  for (const item of refs || []) {
    const reference = (item as any).bible_references;
    if (!reference?.id || reference.text_cache) continue;

    try {
      const fetched = await fetchBibleTextFromFreeBibleApi(
        reference.book,
        reference.chapter,
        reference.verse_start,
        reference.verse_end,
      );

      const { error: updateError } = await supabase
        .from("bible_references")
        .update({
          text_cache: fetched.text,
          source_url: fetched.url,
          copyright_notes:
            fetched.copyrightNotes || `Text preluat din fallback local (${fetched.version}). Verifică textul înainte de folosire publică.`,
        })
        .eq("id", reference.id);

      if (!updateError) fetchedCount += 1;
    } catch {
      // Dacă un verset nu poate fi preluat, continuăm cu restul ca să nu blocăm tot lotul.
    }
  }

  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/songs/${songId}/verses`);
  redirect(`/songs/${songId}/verses?texts_fetched=${fetchedCount}`);
}

export async function deleteSongBibleReferenceAction(formData: FormData) {
  const songId = readString(formData, "song_id");
  const relationId = readString(formData, "relation_id");
  const confirm = readString(formData, "confirm");

  if (!songId) throw new Error("Lipsește ID-ul cântării.");
  if (!relationId) throw new Error("Lipsește ID-ul versetului asociat.");
  if (confirm !== "STERGE")
    throw new Error("Pentru ștergere trebuie să scrii exact: STERGE");

  const supabase = await createClient();
  const { error } = await supabase
    .from("song_bible_references")
    .delete()
    .eq("id", relationId)
    .eq("song_id", songId);

  if (error) throw new Error(error.message);

  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/songs/${songId}/verses`);
  redirect(`/songs/${songId}/verses?deleted=1`);
}

export async function deleteSongAction(formData: FormData) {
  const songId = readString(formData, "song_id");
  const confirm = readString(formData, "confirm");

  if (!songId) throw new Error("Lipsește ID-ul cântării.");
  if (confirm !== "STERGE")
    throw new Error("Pentru ștergere trebuie să scrii exact: STERGE");

  const supabase = await createClient();

  // Eliminăm mai întâi aparițiile din programe; altfel FK-ul ar păstra elemente goale cu song_id null.
  const { error: meetingItemsError } = await supabase
    .from("meeting_items")
    .delete()
    .eq("song_id", songId);
  if (meetingItemsError) throw new Error(meetingItemsError.message);

  const { error } = await supabase.from("songs").delete().eq("id", songId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/songs");
  revalidatePath("/review");
  revalidatePath("/meetings");
  redirect("/songs");
}


export async function bulkDeleteSongsAction(formData: FormData) {
  const songIds = formData
    .getAll("song_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const confirm = readString(formData, "confirm");
  const currentQuery = readString(formData, "current_query");

  if (songIds.length === 0) throw new Error("Nu ai selectat nicio cântare.");
  if (confirm !== "STERGE") throw new Error("Pentru ștergere trebuie să scrii exact: STERGE");

  const uniqueSongIds = [...new Set(songIds)];
  const supabase = await createClient();

  const { error: meetingItemsError } = await supabase
    .from("meeting_items")
    .delete()
    .in("song_id", uniqueSongIds);
  if (meetingItemsError) throw new Error(meetingItemsError.message);

  const { error: filesError } = await supabase
    .from("song_files")
    .delete()
    .in("song_id", uniqueSongIds);
  if (filesError) throw new Error(filesError.message);

  const { error: songsError } = await supabase
    .from("songs")
    .delete()
    .in("id", uniqueSongIds);
  if (songsError) throw new Error(songsError.message);

  revalidatePath("/dashboard");
  revalidatePath("/songs");
  revalidatePath("/review");
  revalidatePath("/meetings");

  const params = new URLSearchParams(currentQuery || "");
  params.set("deleted", String(uniqueSongIds.length));
  redirect(`/songs?${params.toString()}`);
}
