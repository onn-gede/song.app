"use client";
import { collectionStyle } from "@/lib/collection-colors";
import { songProgramMetadata, programMomentLabels as labels } from "@/lib/program-display";
import { useMeetingState } from "./MeetingState";
import { formatDateTime } from "@/lib/format";
import type { MeetingProgramItem } from "./MeetingProgramBoard";

export function MeetingPrintDocument({
  title,
  date,
  programKind = "official",
  principal: initialPrincipal,
  secondary: initialSecondary,
  items: initialItems,
}: {
  title: string;
  date: string;
  programKind?: string;
  principal: string | null;
  secondary: string[];
  items: MeetingProgramItem[];
}) {
  const state = useMeetingState();
  const items = state?.snapshot.items || initialItems;
  const principal = state?.snapshot.principal || initialPrincipal;
  const secondary = state?.snapshot.secondary || initialSecondary;

  return (
    <article className="meeting-print-document">
      <header>
        <span className="print-eyebrow">SongApp · Program</span>
        <h1>{title}</h1>
        <div className="print-program-meta">
          <p>
            <span>Data și ora</span>
            <strong>{formatDateTime(date)}</strong>
          </p>
          <p>
            <span>Tip</span>
            <strong>{programKind === "rehearsal" ? "Repetiție" : "Program oficial"}</strong>
          </p>
          {principal ? (
            <p>
              <span>Responsabil principal</span>
              <strong>{principal}</strong>
            </p>
          ) : null}
          {secondary.length ? (
            <p>
              <span>Responsabili secundari</span>
              <strong>{secondary.join(", ")}</strong>
            </p>
          ) : null}
        </div>
      </header>
      {[false, true].map((backup) => {
        const group = items
          .filter((item) => item.is_backup === backup)
          .sort((a, b) => a.position - b.position);
        if (!group.length) return null;
        return (
          <section key={String(backup)}>
            <h2>{backup ? "Cântări backup" : "Program principal"}</h2>
            <ol className="print-program-list">
              {group.map((item) => {
                const metadata = songProgramMetadata(item, item.songs);
                const { source, musicalKey, bpm, verseCount, structure } = metadata;
                return (
                  <li
                    key={item.id}
                    style={item.song_id ? collectionStyle(source) : { color: item.moment_color || "#d97706" }}
                    className={!item.song_id ? "print-moment" : ""}
                  >
                    <div className="print-item-heading">
                      <strong>
                        {item.songs?.title ||
                          item.custom_title ||
                          labels[item.moment_kind || item.item_type] ||
                          "Moment"}
                      </strong>
                      <span>
                        {[musicalKey ? `Tonalitate ${musicalKey}` : null, bpm ? `${bpm} BPM` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    {item.song_id && source ? (
                      <p className="print-source-meta">
                        Nr. {source.number || "—"} · {source.name}
                      </p>
                    ) : null}
                    {item.song_id ? (
                      <small>
                        {verseCount == null ? "Strofe: —" : `${verseCount} strofe`}
                        {structure ? ` · ${structure}` : ""}
                      </small>
                    ) : null}
                    {item.song_id && item.is_congregational ? (
                      <p className="congregational-tag">Cântare în comun</p>
                    ) : null}
                    {!item.song_id ? (
                      <small>{labels[item.moment_kind || item.item_type] || "Moment"}</small>
                    ) : null}
                    {item.song_id && item.responsible_name ? <p>Solist: {item.responsible_name}</p> : null}
                    {(item.song_id ? item.notes : item.custom_text) ? (
                      <p className="print-item-text">{item.song_id ? item.notes : item.custom_text}</p>
                    ) : null}
                    {!item.song_id && item.notes ? (
                      <p className="print-item-text">Observații: {item.notes}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </article>
  );
}
