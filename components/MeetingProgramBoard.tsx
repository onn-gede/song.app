"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  moveMeetingItemAction,
  removeMeetingItemAction,
  reorderMeetingItemsAction,
  updateMeetingTextItemAction,
  type RecentUsage
} from "@/app/(app)/meetings/actions";
import { getRecentUsageTooltip, RecentUsageIcon } from "@/components/RecentUsageIcon";

export type MeetingProgramItem = {
  id: string;
  position: number;
  item_type: string;
  song_id: string | null;
  custom_title: string | null;
  custom_text: string | null;
  selected_key: string | null;
  selected_bpm: number | null;
  is_backup: boolean;
  notes: string | null;
  songs: {
    id: string;
    title: string;
    lyrics_text: string | null;
    default_key: string | null;
    bpm: number | null;
    structure: string | null;
  } | null;
};

type Props = {
  meetingId: string;
  items: MeetingProgramItem[];
  recentUsage?: Record<string, RecentUsage>;
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
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  isDragging,
  isDropTarget,
  recentUsage
}: {
  item: MeetingProgramItem;
  meetingId: string;
  displayPosition: number;
  draggable: boolean;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
  recentUsage?: RecentUsage;
}) {
  const [editing, setEditing] = useState(false);
  const song = item.songs;
  const recentLabel = song ? getRecentUsageTooltip(recentUsage) : null;
  const textItemTitle = itemLabel(item);

  return (
    <div
      className={`program-item-v10 ${item.is_backup ? "program-item-backup" : ""} ${recentLabel ? "program-item-warning" : ""} ${isDragging ? "is-dragging" : ""} ${isDropTarget ? "is-drop-target" : ""}`}
      draggable={draggable && !editing}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="program-handle" title="Trage pentru reordonare" aria-label="Trage pentru reordonare">
        <span className="drag-grip">⋮⋮</span>
        <span className="drag-label">Trage</span>
      </div>
      <div className="program-main">
        <div className="program-title-line-v10">
          <span className="program-position">{displayPosition}</span>
          <div className="program-title-wrap">
            <div className="program-title">
              {song ? <Link href={`/songs/${song.id}`}>{song.title}</Link> : textItemTitle}
            </div>
            <div className="badges compact-badges">
              {!song && item.custom_title ? <span className="badge muted-badge">{itemTypeLabels[item.item_type] || "Element"}</span> : null}
              {item.is_backup ? <span className="badge backup">backup</span> : null}
              {song && (item.selected_key || song.default_key) ? <span className="badge">Tonalitate: {item.selected_key || song.default_key}</span> : null}
              {song && (item.selected_bpm || song.bpm) ? <span className="badge">{item.selected_bpm || song.bpm} BPM</span> : null}
              {song?.structure ? <span className="badge">{song.structure}</span> : null}
              {recentLabel ? <RecentUsageIcon usage={recentUsage} /> : null}
            </div>
          </div>
        </div>

        {song ? (
          item.notes ? <p className="muted small compact-note-clean">{item.notes}</p> : null
        ) : editing ? (
          <form action={updateMeetingTextItemAction} className="text-item-edit-form">
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
          item.custom_text ? <p className="lyrics compact-text-v10">{item.custom_text}</p> : null
        )}
      </div>

      <div className="program-actions-v10">
        <form action={moveMeetingItemAction} className="mini-action-grid">
          <input type="hidden" name="meeting_id" value={meetingId} />
          <input type="hidden" name="item_id" value={item.id} />
          <button className="icon-btn" type="submit" name="direction" value="up" title="Mută mai sus" aria-label="Mută mai sus">↑</button>
          <button className="icon-btn" type="submit" name="direction" value="down" title="Mută mai jos" aria-label="Mută mai jos">↓</button>
        </form>
        {!song ? (
          <button className="icon-btn" type="button" title="Editează" aria-label="Editează" onClick={() => setEditing((value) => !value)}>✎</button>
        ) : null}
        <form action={removeMeetingItemAction}>
          <input type="hidden" name="meeting_id" value={meetingId} />
          <input type="hidden" name="item_id" value={item.id} />
          <button className="icon-btn danger-text" type="submit" title="Șterge" aria-label="Șterge">×</button>
        </form>
      </div>
    </div>
  );
}

function ProgramGroup({
  title,
  emptyText,
  meetingId,
  items,
  recentUsage,
  isBackup
}: {
  title: string;
  emptyText?: string;
  meetingId: string;
  items: MeetingProgramItem[];
  recentUsage?: Record<string, RecentUsage>;
  isBackup: boolean;
}) {
  const [orderedItems, setOrderedItems] = useState(() => sortItems(items));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasItems = orderedItems.length > 0;

  useEffect(() => {
    setOrderedItems(sortItems(items));
  }, [items]);

  function reorder(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDropTargetId(null);
      return;
    }

    const current = [...orderedItems];
    const fromIndex = current.findIndex((item) => item.id === draggedId);
    const toIndex = current.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    setOrderedItems(current);
    setDraggedId(null);
    setDropTargetId(null);
    setMessage("Ordinea a fost actualizată.");
    setError(null);

    startTransition(async () => {
      try {
        await reorderMeetingItemsAction({
          meetingId,
          itemIds: current.map((item) => item.id),
          isBackup
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nu am putut salva ordinea.");
        setOrderedItems(sortItems(items));
      }
    });
  }

  return (
    <div className={`program-group ${isBackup ? "program-group-backup" : ""}`}>
      <div className="program-group-header">
        <div>
          <div className="eyebrow">{title}</div>
          {hasItems ? <p className="muted small">Apasă pe mânerul „Trage” și mută elementul în poziția dorită.</p> : null}
        </div>
        {isPending ? <span className="badge">salvez…</span> : null}
      </div>
      {message ? <p className="success compact-status">{message}</p> : null}
      {error ? <p className="error compact-status">{error}</p> : null}
      {!hasItems && emptyText ? <p className="muted">{emptyText}</p> : null}
      {hasItems ? (
        <div className="program-list-v10">
          {orderedItems.map((item, index) => (
            <ProgramCard
              key={item.id}
              item={item}
              meetingId={meetingId}
              displayPosition={index + 1}
              draggable={!isPending}
              onDragStart={() => setDraggedId(item.id)}
              onDragEnter={() => setDropTargetId(item.id)}
              onDragLeave={() => setDropTargetId((current) => current === item.id ? null : current)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => reorder(item.id)}
              isDragging={draggedId === item.id}
              isDropTarget={dropTargetId === item.id && draggedId !== item.id}
              recentUsage={item.song_id ? recentUsage?.[item.song_id] : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MeetingProgramBoard({ meetingId, items, recentUsage = {} }: Props) {
  const mainItems = useMemo(() => sortItems(items.filter((item) => !item.is_backup)), [items]);
  const backupItems = useMemo(() => sortItems(items.filter((item) => item.is_backup)), [items]);

  return (
    <div className="program-board-v10">
      <ProgramGroup
        title="Program principal"
        emptyText="Programul este gol. Caută o cântare și adaug-o în listă."
        meetingId={meetingId}
        items={mainItems}
        recentUsage={recentUsage}
        isBackup={false}
      />
      <ProgramGroup
        title="Cântări backup"
        meetingId={meetingId}
        items={backupItems}
        recentUsage={recentUsage}
        isBackup={true}
      />
    </div>
  );
}
