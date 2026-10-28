"use client";

import Link from "next/link";
import { useMeetingState } from "./MeetingState";
import { useRef, useState, useTransition } from "react";
import {
  placeMeetingItemAction,
  updateItemResponsibleAction,
  removeMeetingItemAction,
  updateMeetingTextItemAction,
  type RecentUsage
} from "@/app/(app)/meetings/actions";
import { getRecentUsageTooltip, RecentUsageIcon } from "@/components/RecentUsageIcon";

export type MeetingProgramItem = import("@/lib/meeting-state").ProgramItem;

type Props = {
  meetingId: string;
  items: MeetingProgramItem[];
  recentUsage?: Record<string, RecentUsage>;
  canManage?: boolean;
};

const itemTypeLabels: Record<string, string> = {
  text: "Poezie",
  prayer: "Rugăciune",
  encouragement: "Îndemn",
  message: "Mesaj",
  break: "Pauză",
  song: "Cântare"
};

function sortItems(items: MeetingProgramItem[]) {
  return [...items].sort((a, b) => a.position - b.position);
}

function itemLabel(item: MeetingProgramItem) {
  if (item.songs) return item.songs.title;
  return item.custom_title || itemTypeLabels[item.item_type] || "Element text";
}

function ProgramCard({
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
  last
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
}) {
  const state = useMeetingState();
  const [editing, setEditing] = useState(false);
  const song = item.songs;
  const recentLabel = song ? getRecentUsageTooltip(recentUsage) : null;
  const textItemTitle = itemLabel(item);

  return (
    <div
      className={`program-item-v10 ${!item.song_id ? "program-item-moment" : ""} ${item.is_backup ? "program-item-backup" : ""} ${recentLabel ? "program-item-warning" : ""} ${isDragging ? "is-dragging" : ""} ${isDropTarget ? "is-drop-target" : ""}`}
      data-item-id={item.id}
    >
      {canManage ? <div className="program-handle" onPointerDown={event => { if (draggable && !editing) onPointerStart(event); }} title="Trage pentru reordonare" aria-label="Trage pentru reordonare">
        <span className="drag-grip">⋮⋮</span>
        <span className="drag-label">Trage</span>
      </div> : null}
      <div className="program-main">
        <div className="program-title-line-v10">
          <span className="program-position">{displayPosition}</span>
          <div className="program-title-wrap">
            <div className="program-title">
              {song ? <Link href={`/songs/${song.id}`}>{song.title}</Link> : textItemTitle}
            </div>
            <div className="badges compact-badges">
              {!song && item.custom_title ? <span className="badge muted-badge">{itemTypeLabels[item.item_type] || "Element"}</span> : null}
              {item.responsible_name ? <span className="badge">Solist: {item.responsible_name}</span> : null}
              {item.is_backup ? <span className="badge backup">backup</span> : null}
              {song && (item.selected_key || song.default_key) ? <span className="badge">{item.selected_key || song.default_key}</span> : null}
              {song && (item.selected_bpm || song.bpm) ? <span className="badge">{item.selected_bpm || song.bpm} BPM</span> : null}
              {song?.structure ? <span className="badge">{song.structure}</span> : null}
              {recentLabel ? <RecentUsageIcon usage={recentUsage} /> : null}
            </div>
          </div>
        </div>

        {song ? (
          item.notes ? <p className="muted small compact-note-clean" title={item.notes}>{item.notes}</p> : null
        ) : editing ? (
          <form action={async data => { const saved = await updateMeetingTextItemAction(data); state?.apply(saved); setEditing(false); }} className="text-item-edit-form">
            <input type="hidden" name="meeting_id" value={meetingId} />
            <input type="hidden" name="item_id" value={item.id} />
            <div className="form-two-tight">
              <label className="label">Tip
                <select className="select select-tight" name="item_type" defaultValue={item.item_type || "text"}>
                  <option value="text">Poezie</option>
                  <option value="prayer">Rugăciune</option>
                  <option value="encouragement">Îndemn</option>
                  <option value="message">Mesaj</option>
                  <option value="break">Pauză</option>
                </select>
              </label>
              <label className="label">Titlu
                <input className="input input-tight" name="custom_title" defaultValue={item.custom_title || ""} placeholder="Titlul afișat în program" />
              </label>
            </div>
            <label className="label">Text
              <textarea className="textarea textarea-tight" name="custom_text" defaultValue={item.custom_text || ""} placeholder="Detalii afișate în program" />
            </label>
            <div className="inline-form compact-actions">
              <button className="btn btn-compact" type="submit">Salvează</button>
              <button className="btn secondary btn-compact" type="button" onClick={() => setEditing(false)}>Renunță</button>
            </div>
          </form>
        ) : (
          item.custom_text ? <details className="program-moment-text"><summary>Textul momentului</summary><p className="lyrics compact-text-v10">{item.custom_text}</p></details> : null
        )}
        {!song && item.notes ? <p className="muted small compact-note-clean" title={item.notes}>{item.notes}</p> : null}
        {canManage ? <details className="responsible-editor print-hide"><summary title="Editează solistul și observațiile" aria-label="Solist și observații">✎</summary>
          <form action={async data => { const saved = await updateItemResponsibleAction(data); state?.apply(saved); }} className="inline-form">
            <input type="hidden" name="meeting_id" value={meetingId} /><input type="hidden" name="item_id" value={item.id} />
            <label className="label">Solist<input className="input" name="responsible_name" defaultValue={item.responsible_name || ""} maxLength={120} placeholder="Nume solist / echipă" /></label>
            <label className="label">Observații<textarea className="textarea textarea-tight" name="notes" defaultValue={item.notes || ""} maxLength={5000} placeholder="Observații pentru această piesă" /></label>
            <button className="btn secondary btn-compact">Salvează</button>
          </form>
        </details> : null}
      </div>

      {canManage ? <div className="program-actions-v10">
        <div className="mini-action-grid">
          <button className="icon-btn" type="button" disabled={!draggable || first} onClick={() => onMove("up")} title="Mută mai sus" aria-label="Mută mai sus">↑</button>
          <button className="icon-btn" type="button" disabled={!draggable || last} onClick={() => onMove("down")} title="Mută mai jos" aria-label="Mută mai jos">↓</button>
        </div>
        <button className="btn secondary btn-compact program-transfer" type="button" disabled={!draggable} onClick={onTransfer} title={item.is_backup ? "Mută în programul principal" : "Mută în backup"} aria-label={item.is_backup ? "În principal" : "În backup"}>⇄</button>
        {!song ? (
          <button className="icon-btn" type="button" title="Editează" aria-label="Editează" onClick={() => setEditing((value) => !value)}>✎</button>
        ) : null}
        <form action={async data => { const saved = await removeMeetingItemAction(data); state?.apply(saved); }}>
          <input type="hidden" name="meeting_id" value={meetingId} />
          <input type="hidden" name="item_id" value={item.id} />
          <button className="icon-btn danger-text" type="submit" title="Șterge" aria-label="Șterge">×</button>
        </form>
      </div> : null}
    </div>
  );
}


export function MeetingProgramBoard({ meetingId, items, recentUsage = {}, canManage = false }: Props) {
  const state = useMeetingState();
  items = state?.snapshot.items || items;
  const pointerDrag = useRef<{ id: string; x: number; y: number; started: boolean; target: { backup: boolean; before: string | null } | null } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function place(itemId: string, isBackup: boolean, beforeId: string | null = null) {
    pointerDrag.current = null; setDraggedId(null); setDropTarget(null);
    if (!canManage || pending || itemId === beforeId) return;
    setError("");
    startTransition(async () => {
      try {
        const saved = await placeMeetingItemAction({ meetingId, itemId, isBackup, beforeId });
        state?.apply(saved);
      } catch (err) { setError(err instanceof Error ? err.message : "Mutarea nu a putut fi salvată."); }
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
    <div className="print-hide" role="status" aria-live="polite">{pending ? <span title="Se salvează" aria-label="Se salvează">◌</span> : error ? <span className="error">{error}</span> : null}</div>
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
