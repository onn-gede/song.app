import {primarySource, type CollectionSource} from './collection-colors';
import {effectiveMusicalKey} from './musical-key';
import {PROGRAM_MOMENT_TYPES} from './program-moment-types';

type SongDisplay = {default_key?:string|null; bpm?:number|null; verse_count?:number|null; structure?:string|null};
type ItemDisplay = {selected_key?:string|null; selected_bpm?:number|null; performance_structure?:string|null; selected_source_id?:string|null; sources?:CollectionSource[]; is_congregational?:boolean};
export function songProgramMetadata(item:ItemDisplay,song:SongDisplay|null|undefined) {
  return {
    source: song ? primarySource(item.sources,item.selected_source_id) : null,
    musicalKey: song ? effectiveMusicalKey(item.selected_key,song.default_key) : undefined,
    bpm: song ? item.selected_bpm || song.bpm || null : null,
    verseCount: song ? song.verse_count ?? null : undefined,
    structure: song ? item.performance_structure?.trim() || song.structure?.trim() || null : null,
    isCongregational: !!song && !!item.is_congregational
  };
}
export type SongProgramMetadata = ReturnType<typeof songProgramMetadata>;
export const programMomentLabels:Record<string,string> = Object.fromEntries(PROGRAM_MOMENT_TYPES.map(type=>[type.value,type.label]));
