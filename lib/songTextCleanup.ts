export function normalizeSongLineForCompare(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ăâ]/gi, "a")
    .replace(/[î]/gi, "i")
    .replace(/[șş]/gi, "s")
    .replace(/[țţ]/gi, "t")
    .replace(/^[\s\d.\-–—_#:/()\[\]]+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compact(value: string) {
  return normalizeSongLineForCompare(value).replace(/\s+/g, "");
}

function normalizeSourceNumber(value: string | null | undefined) {
  return compact(String(value || "").replace(/^nr\.?\s*/i, ""));
}

export function isRepeatedSongHeaderLine(
  line: string | null | undefined,
  songTitle?: string | null,
  sourceNumbers: Array<string | null | undefined> = [],
) {
  const rawLine = String(line || "").trim();
  if (!rawLine) return false;

  const lineCompact = compact(rawLine);
  const titleCompact = compact(songTitle || "");
  const numbers = sourceNumbers.map(normalizeSourceNumber).filter(Boolean);

  if (!lineCompact) return false;
  if (titleCompact && lineCompact === titleCompact) return true;

  for (const number of numbers) {
    if (!number) continue;
    if (lineCompact === number) return true;
    if (titleCompact && lineCompact === `${number}${titleCompact}`) return true;
    if (titleCompact && lineCompact === `${titleCompact}${number}`) return true;
    if (
      titleCompact &&
      lineCompact.includes(titleCompact) &&
      lineCompact.includes(number) &&
      lineCompact.length <= titleCompact.length + number.length + 12
    ) {
      return true;
    }
  }

  // Unele importuri pun titlul urmat de un marker scurt de slide, ex. „Titlu 1” sau „1 Titlu”.
  if (titleCompact && lineCompact.includes(titleCompact) && lineCompact.length <= titleCompact.length + 5) {
    const rest = lineCompact.replace(titleCompact, "");
    if (/^\d{1,3}[a-z]?$/.test(rest) || rest === "") return true;
  }

  return false;
}

export function stripRepeatedSongTitleLines(
  content: string | null | undefined,
  songTitle?: string | null,
  sourceNumbers: Array<string | null | undefined> = [],
) {
  if (!content) return "";
  return String(content)
    .split(/\r?\n/)
    .filter((line) => !isRepeatedSongHeaderLine(line, songTitle, sourceNumbers))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanSectionContentForSong(
  content: string | null | undefined,
  songTitle?: string | null,
  sourceNumbers: Array<string | null | undefined> = [],
) {
  return stripRepeatedSongTitleLines(content, songTitle, sourceNumbers);
}

export function cleanSongSectionsForTitle<T extends { content?: string | null }>(
  sections: T[],
  songTitle?: string | null,
  sourceNumbers: Array<string | null | undefined> = [],
): T[] {
  return sections
    .map((section) => ({
      ...section,
      content: cleanSectionContentForSong(section.content || "", songTitle, sourceNumbers),
    }))
    .filter((section) => String(section.content || "").trim().length > 0);
}
