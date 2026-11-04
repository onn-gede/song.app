"use client";
import {requestJson} from '@/lib/client-request';
import type {MeetingSnapshot} from '@/lib/meeting-state';
import Link from 'next/link';
import {useRef,useState,useTransition} from 'react';
import {useProgramChange} from './ProgramChangeTracker';
import {useMeetingState} from './MeetingState';
import {collectionStyle,momentStyle} from '@/lib/collection-colors';
import {PROGRAM_MOMENT_TYPES} from '@/lib/program-moment-types';
import {programMomentLabels as itemTypeLabels,songProgramMetadata} from '@/lib/program-display';
import {SongLyricsTooltip} from "./SongLyricsTooltip";
import {ProgramSongTags} from './ProgramSongTags';
import {updateItemResponsibleAction,removeMeetingItemAction,updateMeetingTextItemAction,type RecentUsage} from '@/app/(app)/meetings/actions';
import {getRecentUsageTooltip,RecentUsageIcon} from './RecentUsageIcon';
import type {ProgramItem as MeetingProgramItem} from '@/lib/meeting-state';
function itemLabel(item:MeetingProgramItem){return item.songs?.title || item.custom_title || itemTypeLabels[item.moment_kind||item.item_type] || 'Element text';}

export function ProgramCard({
  item,
  meetingId,
  displayPosition,
  draggable,
  onPointerStart,
  isDragging,
  isDropTarget,
  recentUsage,
  canManage,
  onMove,
  onTransfer,
  first,
  last,
  returnHref,
  publicSlug
}: {
  item: MeetingProgramItem;
  meetingId: string;
  displayPosition: number;
  draggable: boolean;
  onPointerStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  isDragging: boolean;
  isDropTarget: boolean;
  recentUsage?: RecentUsage;
  canManage: boolean;
  onMove: (direction: "up" | "down") => void;
  onTransfer: () => void;
  first: boolean;
  last: boolean;
  returnHref?: string;
  publicSlug?: string;
}) {
  const state = useMeetingState();
  const changed=useProgramChange(item.id);
  const [editing, setEditing] = useState(false);
  const infoButton=useRef<HTMLButtonElement>(null);
  const [infoEditing,setInfoEditing]=useState(false);
  const saving=useRef(false);
  const removing=useRef(false);
  const [removePending,setRemovePending]=useState(false);
  const [savingInfo,startInfo]=useTransition();
  const [infoError,setInfoError]=useState("");
  const [commonPending,setCommonPending]=useState(false);
  const [commonOverride,setCommonOverride]=useState<boolean|null>(null);
  const commonValue=commonOverride??!!item.is_congregational;
  const commonSaving=useRef(false);
  const [commonError,setCommonError]=useState("");
  const song = item.songs;
  const metadata=songProgramMetadata(item,song);
  const {source}=metadata;
  const recentLabel = song ? getRecentUsageTooltip(recentUsage) : null;
  const textItemTitle = itemLabel(item);
  const songHref = song ? `/songs/${song.id}${returnHref?`?returnTo=${encodeURIComponent(returnHref)}`:""}` : "";
  const presentationHref = song ? (publicSlug ? `/program/${publicSlug}/songs/${song.id}/present` : `/songs/${song.id}/present${returnHref?`?returnTo=${encodeURIComponent(returnHref)}`:""}`) : "";

  return (
    <div
      className={`program-item-v10 ${changed?"recent-program-change":""} ${!item.song_id ? "program-item-moment" : ""} ${item.is_backup ? "program-item-backup" : ""} ${recentLabel ? "program-item-warning" : ""} ${isDragging ? "is-dragging" : ""} ${isDropTarget ? "is-drop-target" : ""}`}
      data-item-id={item.id}
      data-source-color={song ? source?.color||"unassigned" : undefined}
      style={song ? collectionStyle(source) : momentStyle(item)}
    >
      {canManage ? <div className="program-handle" onPointerDown={event => { if (draggable && !editing) onPointerStart(event); }} title="Trage pentru reordonare" aria-label="Trage pentru reordonare">
        <span className="drag-grip">⋮⋮</span>
      </div> : null}
      <div className="program-main">
        <div className="program-title-line-v10">
          <span className="program-position">{displayPosition}</span>
          <div className="program-title-wrap">
            <div className="program-title">
              {song ? canManage?<Link href={songHref}>{song.title}</Link>:song.title : textItemTitle}
            </div>
            <div className="badges compact-badges">
              {!song && item.custom_title ? <span className="badge muted-badge">{itemTypeLabels[item.moment_kind||item.item_type] || "Element"}</span> : null}
              {item.is_backup ? <span className="badge backup">backup</span> : null}
              {song ? <ProgramSongTags metadata={metadata} onEditStructure={canManage?()=>setInfoEditing(true):undefined} commonControl={song && canManage ? <button type="button" className={"badge congregational-toggle"+(commonValue?" is-selected":"")} aria-pressed={commonValue} aria-busy={commonPending} disabled={commonPending} title={commonValue?"Elimină marcajul de cântare în comun":"Marchează drept cântare în comun"} onClick={async()=>{
                if(commonSaving.current)return;commonSaving.current=true;const enabled=!commonValue;setCommonOverride(enabled);setCommonPending(true);setCommonError("");
                try{const data=await requestJson<{snapshot:MeetingSnapshot}>(`/api/meetings/${meetingId}/live`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'common',itemId:item.id,enabled})});state?.apply(data.snapshot);}
                catch(e){setCommonError(e instanceof Error?e.message:"Salvarea a eșuat.");}
                finally{setCommonOverride(null);setCommonPending(false);commonSaving.current=false;}
              }}>{commonValue?"Cântare în comun":"Cântare comun"}</button>:song&&item.is_congregational?<span className="badge congregational-tag">Cântare în comun</span>:null}/> : null}

              {song?<SongLyricsTooltip songId={song.id} title={song.title}/>:null}
              {song && (canManage || publicSlug) ? <Link className="btn secondary btn-compact program-song-present" href={presentationHref} title={`Prezintă ${song.title}`}>Prezintă</Link> : null}
              {recentLabel ? <RecentUsageIcon usage={recentUsage} /> : null}
            </div>
          </div>
        </div>

        {song ? (
          null
        ) : editing ? (
          <form onSubmit={event=>{event.preventDefault();if(saving.current)return;saving.current=true;setInfoError("");const data=new FormData(event.currentTarget);startInfo(async()=>{try{const saved=await updateMeetingTextItemAction(data);state?.apply(saved);setEditing(false);}catch(e){setInfoError(e instanceof Error?e.message:"Salvarea a eșuat.");}finally{saving.current=false;}});}} className="text-item-edit-form"><fieldset className="save-form-fields" disabled={savingInfo}>
            <input type="hidden" name="meeting_id" value={meetingId} />
            <input type="hidden" name="item_id" value={item.id} />
            <div className="form-two-tight">
              <label className="label">Tip
                <select className="select select-tight" name="item_type" defaultValue={item.moment_kind||item.item_type || "text"}>{PROGRAM_MOMENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
              </label>
              <label className="label">Titlu
                <input className="input input-tight" name="custom_title" defaultValue={item.custom_title || ""} placeholder="Titlul afișat în program" />
              </label>
            </div>
            <label className="label">Observații
              <textarea className="textarea textarea-tight" name="custom_text" defaultValue={[item.custom_text,item.notes].filter(Boolean).join("\n\n")} placeholder="Detalii afișate în program" />
            </label>
            <div className="inline-form compact-actions">
              <button className="btn btn-compact" type="submit">Salvează</button>
              <button className="btn secondary btn-compact" type="button" onClick={() => setEditing(false)}>Renunță</button>
            </div>
          </fieldset>{infoError?<p className="error" role="alert">{infoError}</p>:null}</form>
        ) : (
          <div className="program-moment-observations">{[item.custom_text,item.notes].filter(Boolean).map((text,index)=><p key={index}>{text}</p>)}</div>
        )}
        {song&&!canManage&&song.lyrics_text?<details className="public-program-lyrics-details"><summary>Vezi versurile</summary><pre>{song.lyrics_text}</pre></details>:null}
        {infoError&&!infoEditing&&!editing?<p className="error" role="alert">{infoError}</p>:null}
        {commonError?<p className="error" role="alert">{commonError}</p>:null}
        {song ? <div className="program-info-line">{item.responsible_name?<span><strong>Solist:</strong> {item.responsible_name}</span>:null}{item.notes?<span className="program-inline-notes" title={item.notes}><strong>Observații:</strong> {item.notes}</span>:null}{!item.responsible_name&&!item.notes&&canManage?<span className="muted">Solist · observații</span>:null}{canManage?<button ref={infoButton} type="button" className="inline-edit-button" title="Editează solistul și observațiile" aria-label="Solist și observații" aria-expanded={infoEditing} onClick={()=>{setInfoEditing(v=>!v);setInfoError("");}}>✎</button>:null}</div>
        : null}
        {song && canManage && infoEditing ? <div className="responsible-editor print-hide">
          <form onSubmit={event=>{
            event.preventDefault();if(saving.current)return;saving.current=true;setInfoError("");
            const data=new FormData(event.currentTarget);
            startInfo(async()=>{try{
              const saved=await updateItemResponsibleAction(data);state?.apply(saved);
              setInfoEditing(false);infoButton.current?.focus({preventScroll:true});
            }catch(error){setInfoError(error instanceof Error?error.message:"Salvarea a eșuat.");}
            finally{saving.current=false;}});
          }}>
            <fieldset disabled={savingInfo} className="meeting-form-fields">
            <input type="hidden" name="meeting_id" value={meetingId} /><input type="hidden" name="item_id" value={item.id} />
            <label className="label">Strofe<input className="input" type="number" name="verse_count" min="0" max="100" defaultValue={song.verse_count??""} placeholder="Necunoscut"/></label><label className="label">Structură în acest program<input className="input" name="performance_structure" defaultValue={item.performance_structure||""} placeholder={song.structure||"S1,R,S2,R,B,R"} maxLength={300}/><small>S = strofă, R = refren, B = bridge. Gol = structura cântării.</small></label><label className="label">Solist<input className="input" name="responsible_name" defaultValue={item.responsible_name || ""} maxLength={120} placeholder="Nume solist / echipă" /></label>
            {song ? <label className="label">Tonalitate<input className="input" name="selected_key" defaultValue={item.selected_key || ""} maxLength={20} placeholder={song.default_key ? `Implicit: ${song.default_key}` : "Ex.: G, Em, F#"} /></label> : null}
            {song && item.sources?.length ? <label className="label program-source-editor">Colecție de referință<select className="select" aria-label="Colecție de referință" name="selected_source_id" defaultValue={source?.source_id||""}>{item.sources.map(s=><option key={s.source_id} value={s.source_id}>{s.name} · nr. {s.number||"—"}</option>)}</select></label>:null}
            <label className="label">Observații<textarea className="textarea textarea-tight" name="notes" defaultValue={item.notes || ""} maxLength={5000} placeholder="Observații pentru această piesă" /></label>
            <div className="inline-form"><button className="btn secondary btn-compact" type="submit">{savingInfo?"Se salvează…":"Salvează"}</button><button className="btn secondary btn-compact" type="button" onClick={()=>{setInfoEditing(false);setInfoError("");}}>Închide</button></div>
            </fieldset>
            {infoError?<p className="error" role="alert">{infoError}</p>:null}
          </form>
        </div> : null}
      </div>

      {canManage ? <div className="program-actions-v10">
        <div className="mini-action-grid">
          <button className="icon-btn" type="button" disabled={!draggable || first} onClick={() => onMove("up")} title="Mută mai sus" aria-label="Mută mai sus">↑</button>
          <button className="icon-btn" type="button" disabled={!draggable || last} onClick={() => onMove("down")} title="Mută mai jos" aria-label="Mută mai jos">↓</button>
        </div>
        <button className="btn secondary btn-compact program-transfer" type="button" disabled={!draggable} onClick={onTransfer} title={item.is_backup ? "Mută în programul principal" : "Mută în backup"} aria-label={item.is_backup ? "În principal" : "În backup"}>⇄</button>
        {!song ? (
          <button className="icon-btn" type="button" title="Editează" aria-label="Editează" onClick={() => {setEditing((value) => !value);setInfoError("");}}>✎</button>
        ) : null}
        <form action={async data => {if(removing.current)return;removing.current=true;setRemovePending(true);setInfoError('');try{const saved=await removeMeetingItemAction(data);state?.apply(saved);}catch(e){setInfoError(e instanceof Error?e.message:'Ștergerea nu a fost confirmată.');}finally{removing.current=false;setRemovePending(false);}}}>
          <input type="hidden" name="meeting_id" value={meetingId} />
          <input type="hidden" name="item_id" value={item.id} />
          <button className="icon-btn danger-text" type="submit" disabled={removePending} aria-busy={removePending} title="Șterge" aria-label="Șterge">×</button>
        </form>
      </div> : null}
    </div>
  );
}

