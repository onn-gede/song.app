import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SongSearch } from "@/components/SongSearch";
import { formatDateTime } from "@/lib/format";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: songsCount }, { count: meetingsCount }, { count: categoriesCount }, { count: collectionsCount }, { count: reviewCount }, { data: recentUsage }, { data: recentMeetings }] = await Promise.all([
    supabase.from("songs").select("id", { count: "exact", head: true }),
    supabase.from("meetings").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("song_collections").select("id", { count: "exact", head: true }),
    supabase.from("song_files").select("id", { count: "exact", head: true }).eq("import_status", "needs_review"),
    supabase.rpc("get_song_recent_usage", { days_back: 30 }),
    supabase.from("meetings").select("id,title,meeting_date,status").order("meeting_date", { ascending: false }).limit(5)
  ]);

  return (
    <>
      <div className="top-row">
        <div>
          <div className="eyebrow">Dashboard</div>
          <h1>Caută, alege și construiește programul</h1>
        </div>
        <div className="inline-form"><Link className="btn secondary" href="/import">Import fișiere</Link><Link className="btn secondary" href="/review">Verificare import</Link><Link className="btn" href="/meetings">Programe</Link></div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="stat"><strong>{songsCount ?? 0}</strong><span>cântări în bibliotecă</span></div>
        <Link className="stat" href="/collections"><strong>{collectionsCount ?? 0}</strong><span>colecții / surse</span></Link>
        <div className="stat"><strong>{categoriesCount ?? 0}</strong><span>categorii tematice</span></div>
        <Link className="stat" href="/review"><strong>{reviewCount ?? 0}</strong><span>importuri de verificat</span></Link>
      </div>

      <SongSearch autofocus />

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <section className="card">
          <h2>Programe recente</h2>
          <div className="list">
            {(recentMeetings || []).map((meeting: any) => (
              <Link className="row" href={`/meetings/${meeting.id}`} key={meeting.id}>
                <span className="row-main">
                  <span className="row-title">{meeting.title}</span>
                  <span className="muted small">{formatDateTime(meeting.meeting_date)} · {meeting.status}</span>
                </span>
              </Link>
            ))}
            {(!recentMeetings || recentMeetings.length === 0) ? <p className="muted">Nu există programe încă.</p> : null}
          </div>
        </section>

        <section className="card">
          <h2>Avertizări 30 zile</h2>
          <div className="list">
            {(recentUsage || []).slice(0, 5).map((item: any) => (
              <Link className="row" href={`/songs/${item.song_id}`} key={item.song_id}>
                <span className="row-main">
                  <span className="row-title">{item.title}</span>
                  <span className="muted small">Ultima folosire: {formatDateTime(item.last_used_at)} · {item.last_meeting_title}</span>
                </span>
                <span className="badge warning">{item.times_used}x</span>
              </Link>
            ))}
            {(!recentUsage || recentUsage.length === 0) ? <p className="muted">Nu există încă folosiri în ultimele 30 de zile.</p> : null}
          </div>
        </section>
      </div>
    </>
  );
}
