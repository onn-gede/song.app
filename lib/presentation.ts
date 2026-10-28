import { stripRepeatedSongTitleLines } from "./songTextCleanup";
export type PresentationSlide = { id: string; label: string; content: string };
type Section = { id: string; position: number; section_label: string | null; section_type: string; content: string };
export type PresentationItem = {
  id: string; position: number; is_backup: boolean; custom_title: string | null;
  custom_text: string | null; item_type: string;
  songs: { title: string; lyrics_text: string | null; song_sections: Section[] } | null;
};
const types: Record<string, string> = { chorus: "Refren", bridge: "Bridge", verse: "Strofă", prayer: "Rugăciune", message: "Mesaj", encouragement: "Îndemn", break: "Pauză", text: "Text" };
export function buildProgramSlides(items: PresentationItem[], includeBackup = false): PresentationSlide[] {
  return [...items].filter((item) => includeBackup || !item.is_backup)
    .sort((a,b) => Number(a.is_backup)-Number(b.is_backup) || a.position-b.position)
    .flatMap((item) => {
      const title = item.songs?.title || item.custom_title || types[item.item_type] || "Element";
      const sections = [...(item.songs?.song_sections || [])].sort((a,b) => a.position-b.position)
        .map((section) => ({ id: `${item.id}:${section.id}`, label: `${title} · ${section.section_label || types[section.section_type] || "Strofă"}`, content: stripRepeatedSongTitleLines(section.content,title) }))
        .filter((slide) => slide.content.trim());
      if (sections.length) return sections;
      const content = item.songs ? stripRepeatedSongTitleLines(item.songs.lyrics_text, title) : item.custom_text;
      const blocks = String(content || "").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
      // Keep title-only prayers/messages visible as a transition slide.
      return blocks.length ? blocks.map((block,index) => ({ id: `${item.id}:${index}`, label: title, content: block })) : [{ id: `${item.id}:title`, label: types[item.item_type] || "Cântare", content: title }];
    });
}
