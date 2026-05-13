import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SongSearch } from "@/components/SongSearch";
import { formatDateTime } from "@/lib/format";

function DashboardStat({ href, value, label, meta }: { href?: string; value: number | string; label: string; meta: string }) {
  const content = (
    <>
      <span className="dashboard-stat-value">{value}</span>
      <span className="dashboard-stat-label">{label}</span>
      <small>{meta}</small>
    </>
  );

  if (href) return <Link className="dashboard-stat-card" href={href}>{content}</Link>;
  return <div className="dashboard-stat-card">{content}</div>;
}

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

  const reviewTotal = reviewCount ?? 0;
  const recentWarnings = (recentUsage || []).slice(0, 5);
  const meetings = recentMeetings || [];

  return (
    <div className="dashboard-v39">
      <section className="dashboard-hero-v39">
        <div className="dashboard-hero-copy-v39">
          <div className="eyebrow">Dashboard</div>
          <h1>Planificare cântări pentru întâlniri</h1>
          <p className="muted">Caută rapid în bibliotecă, verifică importurile și pregătește playlisturi pentru fiecare program.</p>
          <div className="dashboard-actions-v39">
            <Link className="btn" href="/meetings">Creează / vezi programe</Link>
            <Link className="btn secondary" href="/import">Import cântări</Link>
            {reviewTotal > 0 ? <Link className="btn ghost-v39" href="/review">{reviewTotal} de verificat</Link> : null}
          </div>
        </div>
        <div className="dashboard-search-panel-v39">
          <span className="panel-kicker-v39">Căutare rapidă</span>
          <SongSearch autofocus />
        </div>
      </section>

      <section className="dashboard-stat-grid-v39" aria-label="Statistici aplicație">
        <DashboardStat value={songsCount ?? 0} label="Cântări" meta="în biblioteca activă" href="/songs" />
        <DashboardStat value={meetingsCount ?? 0} label="Programe" meta="create până acum" href="/meetings" />
        <DashboardStat value={collectionsCount ?? 0} label="Colecții" meta="surse organizate" href="/collections" />
        <DashboardStat value={categoriesCount ?? 0} label="Categorii" meta="tematici definite" href="/categories" />
        <DashboardStat value={reviewTotal} label="De verificat" meta="importuri recente" href="/review" />
      </section>

      <section className="dashboard-content-grid-v39">
        <div className="dashboard-card-v39">
          <div className="dashboard-card-head-v39">
            <div>
              <span className="panel-kicker-v39">Activitate</span>
              <h2>Programe recente</h2>
            </div>
            <Link className="text-action-v39" href="/meetings">Vezi toate</Link>
          </div>
          <div className="list compact-list">
            {meetings.map((meeting: any) => (
              <Link className="dashboard-row-v39" href={`/meetings/${meeting.id}`} key={meeting.id}>
                <span className="row-main">
                  <span className="row-title">{meeting.title}</span>
                  <span className="muted small">{formatDateTime(meeting.meeting_date)}</span>
                </span>
                <span className="row-arrow-v39">→</span>
              </Link>
            ))}
            {meetings.length === 0 ? <p className="muted">Nu există programe încă.</p> : null}
          </div>
        </div>

        <div className="dashboard-card-v39">
          <div className="dashboard-card-head-v39">
            <div>
              <span className="panel-kicker-v39">Atenție</span>
              <h2>Folosite în ultimele 30 zile</h2>
            </div>
            <Link className="text-action-v39" href="/songs">Caută alternative</Link>
          </div>
          <div className="list compact-list">
            {recentWarnings.map((item: any) => (
              <Link className="dashboard-row-v39" href={`/songs/${item.song_id}`} key={item.song_id}>
                <span className="row-main">
                  <span className="row-title">{item.title}</span>
                  <span className="muted small">Ultima folosire: {formatDateTime(item.last_used_at)} · {item.last_meeting_title}</span>
                </span>
                <span className="badge danger-soft-v39">{item.times_used}x</span>
              </Link>
            ))}
            {recentWarnings.length === 0 ? <p className="muted">Nu există încă folosiri în ultimele 30 de zile.</p> : null}
          </div>
        </div>
      </section>

      <section className="dashboard-quick-grid-v39">
        <Link href="/external-sources" className="quick-tile-v39"><strong>Surse externe</strong><span>Sincronizare și importuri Resurse Creștine</span></Link>
        <Link href="/duplicates" className="quick-tile-v39"><strong>Duplicate</strong><span>Curăță cântări similare</span></Link>
        <Link href="/admin" className="quick-tile-v39"><strong>Administrare</strong><span>Resetări și instrumente DB</span></Link>
      </section>
    </div>
  );
}
