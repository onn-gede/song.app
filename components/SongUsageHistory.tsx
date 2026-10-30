import {SongUsageCorrection} from "./SongUsageCorrection";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
export type UsageHistory = { total: number; performed_total?:number; upcoming_total?:number; last_used_at: string | null; entries: Array<{ meeting_id: string; meeting_title: string; meeting_date: string; meeting_type: string | null; is_future?:boolean;is_excluded?:boolean }> };
export function SongUsageHistory({ songId, history, page, error,editable=false }: { songId: string; history: UsageHistory | null; page: number; error: boolean;editable?:boolean }) {
  const groups = new Map<string, UsageHistory["entries"]>();
  for (const entry of history?.entries || []) {
    const month = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric", timeZone: "Europe/Bucharest" }).format(new Date(entry.meeting_date));
    groups.set(month, [...(groups.get(month) || []), entry]);
  }
  const pages = Math.max(1, Math.ceil((history?.total || 0) / 30));
  return <section className="card usage-history" id="istoric-cantare">
    <div className="eyebrow">Calendarul cântării</div><h2>Când a fost cântată</h2>
    {error ? <p className="error">Istoricul nu poate fi încărcat. Verifică aplicarea UPDATE-V46.sql.</p> : <>
      <p className="usage-summary"><strong>{history?.performed_total ?? history?.total ?? 0}</strong> trecute · <strong>{history?.upcoming_total || 0}</strong> programate · ultima cântare: {history?.last_used_at ? formatDateTime(history.last_used_at) : "—"}</p>
      <p className="muted small">Lista principală din programele trecute, curente și viitoare.</p>
      {!history?.total ? <p className="muted">Cântarea nu apare încă în programe.</p> : null}
      {[...groups].map(([month, entries]) => <div className="usage-month" key={month}><h3>{month}</h3><ol>{entries.map(entry => {
        const date = new Date(entry.meeting_date);
        return <li key={entry.meeting_id}><time dateTime={entry.meeting_date} className="usage-date"><strong>{date.toLocaleDateString("ro-RO", { day: "2-digit", timeZone: "Europe/Bucharest" })}</strong><span>{date.toLocaleDateString("ro-RO", { weekday: "short", timeZone: "Europe/Bucharest" })}</span></time><Link prefetch={false} href={`/meetings/${entry.meeting_id}`}><strong>{entry.meeting_title}</strong>{entry.is_excluded?<span className="badge">Exclus din statistici</span>:null}{entry.is_future ? <span className="usage-future">Programată</span> : null}<small>{date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" })}{entry.meeting_type ? ` · ${entry.meeting_type.replace(/_/g, " ")}` : ""}</small></Link>{editable&&!entry.is_future?<SongUsageCorrection songId={songId} entry={entry}/>:null}</li>;
      })}</ol></div>)}
      {pages > 1 ? <nav className="inline-form" aria-label="Paginare istoric cântare">{page > 1 ? <Link href={`/songs/${songId}?usage_page=${page - 1}#istoric-cantare`}>← Mai recente</Link> : null}<span>{page} / {pages}</span>{page < pages ? <Link href={`/songs/${songId}?usage_page=${page + 1}#istoric-cantare`}>Mai vechi →</Link> : null}</nav> : null}
    </>}
  </section>;
}
