"use client";
import {requestJson} from '@/lib/client-request';
import type {MeetingSnapshot} from '@/lib/meeting-state';
import {ProgramCard} from './ProgramCard';
import {reorderedProgram} from '@/lib/program-order';
import {useMeetingState} from './MeetingState';
import {useRef,useState,useTransition} from 'react';
import type {RecentUsage} from '@/app/(app)/meetings/actions';

export type MeetingProgramItem = import("@/lib/meeting-state").ProgramItem;

type Props = {
  meetingId: string;
  items: MeetingProgramItem[];
  recentUsage?: Record<string, RecentUsage>;
  canManage?: boolean;
};

function sortItems(items: MeetingProgramItem[]) {
  return [...items].sort((a, b) => a.position - b.position);
}



export function MeetingProgramBoard({ meetingId, items, recentUsage = {}, canManage = false }: Props) {
  const state = useMeetingState();
  const [optimistic,setOptimistic]=useState<MeetingProgramItem[]|null>(null);
  const moving=useRef(false);
  items = optimistic || state?.snapshot.items || items;
  const pointerDrag = useRef<{ id: string; x: number; y: number; started: boolean; target: { backup: boolean; before: string | null } | null } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function place(itemId: string, isBackup: boolean, beforeId: string | null = null) {
    pointerDrag.current = null; setDraggedId(null); setDropTarget(null);
    if (!canManage || moving.current || itemId === beforeId) return;
    moving.current=true;setOptimistic(reorderedProgram(items,itemId,isBackup,beforeId));
    setError("");
    startTransition(async () => {
      try {
        const saved=await requestJson<{snapshot:MeetingSnapshot}>(`/api/meetings/${meetingId}/live`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'move',itemId,isBackup,beforeId})});
        state?.apply(saved.snapshot);
      } catch (err) { setError(err instanceof Error ? err.message : "Mutarea nu a putut fi salvată."); }
      finally{moving.current=false;setOptimistic(null);}
    });
  }
  return <div className="program-board-v10" aria-busy={pending}
    onPointerMove={event => {
      const drag = pointerDrag.current;
      if (!drag) return;
      if (!drag.started && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
      drag.started = true; setDraggedId(drag.id);
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const group = element?.closest<HTMLElement>("[data-program-group]");
      if (!group) { drag.target = null; setDropTarget(null); return; }
      const backup = group.dataset.programGroup === "backup";
      const before = element?.closest<HTMLElement>("[data-item-id]")?.dataset.itemId || null;
      drag.target = { backup, before };
      setDropTarget(before || (backup ? "backup-end" : "main-end"));
    }}
    onPointerUp={() => {
      const drag = pointerDrag.current; pointerDrag.current = null;
      if (drag?.started && drag.target) place(drag.id, drag.target.backup, drag.target.before);
      else { setDraggedId(null); setDropTarget(null); }
    }}
    onPointerCancel={() => { pointerDrag.current = null; setDraggedId(null); setDropTarget(null); }}
  >
    <div className="print-hide" role="status" aria-live="polite">{pending ? <span title="Se salvează" aria-label="Se salvează">◌</span> : error ? <span className="error" role="alert">{error}</span> : null}</div>
    {[false, true].map(isBackup => {
      const group = sortItems(items.filter(item => item.is_backup === isBackup));
      const endTarget = isBackup ? "backup-end" : "main-end";
      return <section key={String(isBackup)} className={`program-group ${isBackup ? "program-group-backup" : ""}`} data-program-group={isBackup ? "backup" : "main"}>
        <div className="program-group-header"><h3>{isBackup ? "Cântări backup" : "Program principal"} <span className="badge">{group.length}</span></h3></div>
        <div className="program-list-v10">
          {group.map((item, index) => <ProgramCard key={item.id} item={item} meetingId={meetingId} displayPosition={index + 1}
            canManage={canManage} draggable={canManage && !pending} first={index === 0} last={index === group.length - 1}
            onMove={direction => {
              const beforeId = direction === "up" ? group[index - 1]?.id : group[index + 2]?.id;
              place(item.id, isBackup, beforeId || null);
            }}
            onTransfer={() => place(item.id, !isBackup)}
            onPointerStart={event => {
              if (event.button !== 0 || pending) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              pointerDrag.current = { id: item.id, x: event.clientX, y: event.clientY, started: false, target: null };
            }}
            isDragging={draggedId === item.id} isDropTarget={dropTarget === item.id && draggedId !== item.id}
            recentUsage={item.song_id ? recentUsage[item.song_id] : undefined}
          />)}
        </div>
        {canManage ? <div className={`program-drop-zone print-hide ${dropTarget === endTarget ? "is-active" : ""}`} title={`Plasează la sfârșitul ${isBackup ? "listei backup" : "programului principal"}`} aria-label={`Plasează în ${isBackup ? "backup" : "programul principal"}`}>
          <span aria-hidden="true">+</span>
        </div> : !group.length ? <p className="muted">Lista este goală.</p> : null}
      </section>;
    })}
  </div>;
}
