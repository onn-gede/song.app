import type {CollectionSource} from '@/lib/collection-colors';
export function SourceTags({source}:{source:CollectionSource|null}){
 return source?<><span className="badge song-source-number">Nr. {source.number||'—'}</span><span className="badge song-source-collection">{source.name}</span></>:<span className="badge song-source-collection is-unassigned">Fără colecție</span>;
}
