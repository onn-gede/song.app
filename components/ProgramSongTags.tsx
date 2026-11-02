import type {ReactNode} from 'react';
import type {SongProgramMetadata} from '@/lib/program-display';
import {SourceTags} from './SourceTags';

/** Same metadata and order in the editor and the public list; print uses the same resolver. */
export function ProgramSongTags({metadata,onEditStructure,commonControl}:{metadata:SongProgramMetadata;onEditStructure?:()=>void;commonControl?:ReactNode}) {
 const {musicalKey,source,verseCount,structure,isCongregational,bpm}=metadata;
 return <>
   <span className={`badge program-musical-key${musicalKey ? '' : ' is-missing'}`} title={musicalKey ? 'Tonalitatea cântării în acest program' : 'Completează tonalitatea din editorul piesei'}>Tonalitate {musicalKey || '—'}</span>
   <SourceTags source={source}/>
   <span className="badge">{verseCount==null?'Strofe: —':`${verseCount} strofe`}</span>
   {structure?(onEditStructure?<button type="button" className="badge" title="Editează structura și numărul de strofe" onClick={onEditStructure}>Structură: {structure||'—'} ✎</button>:<span className="badge">Structură: {structure}</span>):onEditStructure?<button type="button" className="badge" aria-label="Editează structura cântării" title="Adaugă structură" onClick={onEditStructure}>✎</button>:null}
   {commonControl??(isCongregational?<span className="badge congregational-tag">Cântare în comun</span>:null)}
   {bpm?<span className="badge">{bpm} BPM</span>:null}
 </>;
}
