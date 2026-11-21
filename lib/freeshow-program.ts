import { stripRepeatedSongTitleLines } from "./songTextCleanup";

export type FreeShowProgramSection = {
  section_label?: string | null;
  section_type?: string | null;
  position?: number | null;
  content?: string | null;
};

export type FreeShowProgramRow = {
  id: string;
  position?: number | null;
  custom_title?: string | null;
  custom_text?: string | null;
  notes?: string | null;
  song?: {
    id: string;
    title: string;
    lyrics_text?: string | null;
    default_key?: string | null;
    song_sections?: FreeShowProgramSection[] | null;
  } | null;
};

export type FreeShowProgramItem = {
  id: string;
  kind: "song" | "moment";
  name: string;
  library_name: string;
  source_key: string;
  text: string;
  slide_count: number;
  slides: Array<{ label: string; content: string }>;
};

function clean(value: unknown) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim();
}

function songSlides(row: FreeShowProgramRow) {
  const song = row.song!;
  const sections = [...(song.song_sections || [])]
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));

  if (sections.length) {
    return sections.map((section, index) => ({
      label: clean(section.section_label || section.section_type) || `Strofa ${index + 1}`,
      content: stripRepeatedSongTitleLines(clean(section.content), song.title),
    })).filter((slide) => slide.content);
  }

  return clean(song.lyrics_text).split(/\n\s*\n/).map((content, index) => ({
    label: `Strofa ${index + 1}`,
    content: stripRepeatedSongTitleLines(content, song.title),
  })).filter((slide) => slide.content);
}

export function buildFreeShowProgramItems(rows: FreeShowProgramRow[]): FreeShowProgramItem[] {
  return rows.map((row) => {
    if (row.song) {
      const slides = songSlides(row);
      const name = clean(row.song.title) || "Cântare fără titlu";
      return {
        id: row.id,
        kind: "song" as const,
        name,
        library_name: name,
        source_key: `songapp-song:${row.song.id}`,
        text: slides.map((slide) => slide.content).join("\n\n").slice(0, 1_000_000),
        slide_count: slides.length,
        slides,
      };
    }

    const content = clean(row.custom_text || row.notes);
    const name = clean(row.custom_title) || "Moment";
    const slides = content ? [{ label: name, content }] : [];
    return {
      id: row.id,
      kind: "moment" as const,
      name,
      library_name: `${name} · SongApp ${row.id.slice(0, 8)}`.slice(0, 240),
      source_key: `songapp-meeting-item:${row.id}`,
      text: content.slice(0, 1_000_000),
      slide_count: slides.length,
      slides,
    };
  }).filter((item) => item.text && item.slide_count > 0);
}

export function formatFreeShowProgramDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return clean(value);
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace(",", " ·");
}

export function buildFreeShowProgramPayload(programId: string, programName: string, meetingDate: string | Date, rows: FreeShowProgramRow[]) {
  const items = buildFreeShowProgramItems(rows);
  const dateLabel = formatFreeShowProgramDate(meetingDate);
  const safeId = clean(programId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
  return {
    name: `SongApp · ${clean(programName)}`.slice(0, 240),
    project_id: `songapp-${safeId || "program"}`,
    project_name: `SongApp · ${clean(programName)} · ${dateLabel}`.slice(0, 240),
    meeting_date_label: dateLabel,
    items,
    item_count: items.length,
    slide_count: items.reduce((sum, item) => sum + item.slide_count, 0),
  };
}
