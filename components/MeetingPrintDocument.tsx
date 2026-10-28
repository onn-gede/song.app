"use client";
import { useMeetingState } from "./MeetingState";
import { formatDateTime } from "@/lib/format";
import type { MeetingProgramItem } from "./MeetingProgramBoard";

export function MeetingPrintDocument({ title, date, principal, secondary, items }: { title: string; date: string; principal: string | null; secondary: string[]; items: MeetingProgramItem[] }) {
  const state = useMeetingState();
  if (state) { items = state.snapshot.items; principal = state.snapshot.principal; secondary = state.snapshot.secondary; }
  const labels: Record<string, string> = { text: "Poezie", prayer: "Rugăciune", encouragement: "Îndemn", message: "Mesaj", break: "Pauză" };
  return <article className="meeting-print-document">
    <header><h1>{title}</h1><p>{formatDateTime(date)}</p>{principal ? <p><strong>Responsabil principal:</strong> {principal}</p> : null}{secondary.length ? <p><strong>Responsabili secundari:</strong> {secondary.join(", ")}</p> : null}</header>
    {[false, true].map(backup => {
      const group = items.filter(item => item.is_backup === backup).sort((a, b) => a.position - b.position);
      if (!group.length) return null;
      return <section key={String(backup)}><h2>{backup ? "Cântări backup" : "Program principal"}</h2><ol>{group.map(item => <li key={item.id} className={!item.song_id ? "print-moment" : ""}>
        <div className="print-item-heading"><strong>{item.songs?.title || item.custom_title || labels[item.item_type] || "Moment"}</strong><span>{[item.selected_key || item.songs?.default_key, (item.selected_bpm || item.songs?.bpm) ? `${item.selected_bpm || item.songs?.bpm} BPM` : null].filter(Boolean).join(" · ")}</span></div>
        {!item.song_id ? <small>{labels[item.item_type] || "Moment"}</small> : null}
        {item.responsible_name ? <p>Solist: {item.responsible_name}</p> : null}
        {(item.song_id ? item.notes : item.custom_text) ? <p className="print-item-text">{item.song_id ? item.notes : item.custom_text}</p> : null}
        {!item.song_id && item.notes ? <p className="print-item-text">Observații: {item.notes}</p> : null}
      </li>)}</ol></section>;
    })}
  </article>;
}
