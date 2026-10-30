"use client";
import {primarySource,collectionStyle} from "@/lib/collection-colors";
import { useMeetingState } from "./MeetingState";
import { formatDateTime } from "@/lib/format";
import type { MeetingProgramItem } from "./MeetingProgramBoard";

export function MeetingPrintDocument({ title, date, principal, secondary, items }: { title: string; date: string; principal: string | null; secondary: string[]; items: MeetingProgramItem[] }) {
  const state = useMeetingState();
  if (state) { items = state.snapshot.items; principal = state.snapshot.principal; secondary = state.snapshot.secondary; }
  const labels: Record<string, string> = { song: "Cântare", other: "Diverse", text: "Poezie", prayer: "Rugăciune", encouragement: "Îndemn", message: "Mesaj", break: "Pauză" };
  return <article className="meeting-print-document">
    <header><h1>{title}</h1><p>{formatDateTime(date)}</p>{principal ? <p><strong>Responsabil principal:</strong> {principal}</p> : null}{secondary.length ? <p><strong>Responsabili secundari:</strong> {secondary.join(", ")}</p> : null}</header>
    {[false, true].map(backup => {
      const group = items.filter(item => item.is_backup === backup).sort((a, b) => a.position - b.position);
      if (!group.length) return null;
      return <section key={String(backup)}><h2>{backup ? "Cântări backup" : "Program principal"}</h2><ol>{group.map(item => {const source=primarySource(item.sources,item.selected_source_id);return <li key={item.id} style={item.song_id?collectionStyle(source):{color:item.moment_color||"#d97706"}} className={!item.song_id ? "print-moment" : ""}>
        <div className="print-item-heading"><strong>{item.songs?.title || item.custom_title || labels[item.moment_kind || item.item_type] || "Moment"}</strong><span>{[(item.selected_key || item.songs?.default_key)?`Tonalitate ${item.selected_key || item.songs?.default_key}`:null, (item.selected_bpm || item.songs?.bpm) ? `${item.selected_bpm || item.songs?.bpm} BPM` : null].filter(Boolean).join(" · ")}</span></div>
        {item.song_id&&source?<p className="print-source-meta">Nr. {source.number||"—"} · {source.name}</p>:null}
        {item.song_id?<small>{item.songs?.verse_count==null?"Strofe: —":`${item.songs.verse_count} strofe`}{item.performance_structure||item.songs?.structure?` · Structură: ${item.performance_structure||item.songs?.structure}`:""}</small>:null}
        {item.song_id && item.is_congregational ? <p className="congregational-tag">Cântare în comun</p>:null}
        {!item.song_id ? <small>{labels[item.moment_kind || item.item_type] || "Moment"}</small> : null}
        {item.song_id && item.responsible_name ? <p>Solist: {item.responsible_name}</p> : null}
        {(item.song_id ? item.notes : item.custom_text) ? <p className="print-item-text">{item.song_id ? item.notes : item.custom_text}</p> : null}
        {!item.song_id && item.notes ? <p className="print-item-text">Observații: {item.notes}</p> : null}
      </li>;})}</ol></section>;
    })}
  </article>;
}
