import {primarySource,type CollectionSource} from "./collection-colors";
import {arrangeSections} from "./song-performance";
import { effectiveMusicalKey } from "./musical-key";
import { stripRepeatedSongTitleLines } from "./songTextCleanup";
export type PresentationSlide = { id: string; label: string; content: string; source?:CollectionSource|null;isCongregational?:boolean;momentColor?:string|null;musicalKey?:string|null;verseCount?:number|null;structure?:string|null };
type Section = { id: string; position: number; section_label: string | null; section_type: string; content: string };
export type PresentationItem = {
  sources?:CollectionSource[];selected_source_id?:string|null;is_congregational?:boolean;moment_color?:string|null;performance_structure?:string|null; id: string; position: number; is_backup: boolean; custom_title: string | null;
  custom_text: string | null; item_type: string; moment_kind?: string | null; selected_key?:string|null;
  songs: { verse_count_override?:number|null;structure?:string|null; title: string; default_key?:string|null; lyrics_text: string | null; song_sections: Section[] } | null;
};
const types: Record<string, string> = { chorus: "Refren", bridge: "Bridge", verse: "Strofă", prayer: "Rugăciune", message: "Mesaj", encouragement: "Îndemn", break: "Pauză", text: "Poezie", song: "Cântare", other: "Diverse" };
export function buildProgramSlides(items: PresentationItem[], includeBackup = false): PresentationSlide[] {
  return [...items].filter((item) => includeBackup || !item.is_backup)
    .sort((a,b) => Number(a.is_backup)-Number(b.is_backup) || a.position-b.position)
    .flatMap((item) => {
      const title = item.songs?.title || item.custom_title || types[item.moment_kind || item.item_type] || "Element";
      const musicalKey=item.songs ? effectiveMusicalKey(item.selected_key,item.songs.default_key) : undefined;
      const originalSections=[...(item.songs?.song_sections||[])].sort((a,b)=>a.position-b.position);
      const verseCount=item.songs?item.songs.verse_count_override??(originalSections.filter(s=>s.section_type==='verse').length||null):undefined;
      const structure=item.performance_structure||item.songs?.structure||null;
      let ordered=originalSections;try{ordered=arrangeSections(originalSections,structure);}catch{}
      const metadata={verseCount,structure,source:primarySource(item.sources,item.selected_source_id),isCongregational:!!item.is_congregational,momentColor:item.songs?null:item.moment_color};
      const sections = ordered
        .map((section,index) => ({ id: `${item.id}:${section.id}:${index}`, ...metadata,musicalKey, label: `${title} · ${section.section_label || types[section.section_type] || "Strofă"}`, content: stripRepeatedSongTitleLines(section.content,title) }))
        .filter((slide) => slide.content.trim());
      if (sections.length) return sections;
      const content = item.songs ? stripRepeatedSongTitleLines(item.songs.lyrics_text, title) : item.custom_text;
      const blocks = String(content || "").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
      // Keep title-only prayers/messages visible as a transition slide.
      return blocks.length ? blocks.map((block,index) => ({ id: `${item.id}:${index}`, ...metadata,musicalKey, label: title, content: block })) : [{ id: `${item.id}:title`, ...metadata,musicalKey, label: types[item.moment_kind || item.item_type] || "Cântare", content: title }];
    });
}
