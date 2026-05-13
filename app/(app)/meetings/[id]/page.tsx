import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { AddSongsPanel } from "@/components/AddSongsPanel";
import { CopyButton } from "@/components/CopyButton";
import { MeetingProgramBoard, type MeetingProgramItem } from "@/components/MeetingProgramBoard";
import { PrintButton } from "@/components/PrintButton";
import {
  acceptPublicContributionAction,
  addTextItemAction,
  createShareLinkAction,
  deleteMeetingAction,
  deleteShareLinkAction,
  rejectPublicContributionAction,
  type RecentUsage
} from "../actions";

type PageProps = { params: Promise<{ id: string }> };


type PublicMeetingContribution = {
  id: string;
  contribution_type: string;
  song_id: string | null;
  custom_title: string | null;
  custom_text: string | null;
  is_backup: boolean;
  contributor_name: string | null;
  notes: string | null;
  created_at: string;
  songs: { id: string; title: string; default_key: string | null; bpm: number | null } | { id: string; title: string; default_key: string | null; bpm: number | null }[] | null;
};

function ExternalContributionCard({ meetingId, item }: { meetingId: string; item: PublicMeetingContribution }) {
  const song = Array.isArray(item.songs) ? item.songs[0] : item.songs;
  const title = song?.title || item.custom_title || "Propunere externă";
  return (
    <div className="external-proposal-card">
      <div className="row-main">
        <div className="program-title">{title}</div>
        <div className="badges compact-badges">
          <span className="badge external-badge">adăugată de user extern</span>
          <span className="badge">{item.contribution_type}</span>
          {item.is_backup ? <span className="badge backup">backup</span> : null}
          {item.contributor_name ? <span className="badge">{item.contributor_name}</span> : null}
          {song?.default_key ? <span className="badge">{song.default_key}</span> : null}
        </div>
        {item.custom_text ? <p className="lyrics compact-text-v10 external-proposal-text">{item.custom_text}</p> : null}
        {item.notes ? <p className="muted small compact-note-clean">{item.notes}</p> : null}
      </div>
      <div className="inline-form nowrap">
        <form action={acceptPublicContributionAction}>
          <input type="hidden" name="meeting_id" value={meetingId} />
          <input type="hidden" name="contribution_id" value={item.id} />
          <button className="btn btn-compact" type="submit">Acceptă</button>
        </form>
        <form action={rejectPublicContributionAction}>
          <input type="hidden" name="meeting_id" value={meetingId} />
          <input type="hidden" name="contribution_id" value={item.id} />
          <button className="btn secondary btn-compact" type="submit">Respinge</button>
        </form>
      </div>
    </div>
  );
}

function buildRecentUsageMap(data: unknown): Record<string, RecentUsage> {
  const map: Record<string, RecentUsage> = {};
  ((data || []) as RecentUsage[]).forEach((item) => {
    map[item.song_id] = item;
  });
  return map;
}

export default async function MeetingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: meeting },
    { data: items },
    { data: shareLinks },
    { data: publicContributions }
  ] = await Promise.all([
    supabase.from("meetings").select("*").eq("id", id).single(),
    supabase
      .from("meeting_items")
      .select("*,songs(id,title,lyrics_text,default_key,bpm,structure)")
      .eq("meeting_id", id)
      .order("position"),
    supabase
      .from("meeting_share_links")
      .select("id,public_slug,is_active,expires_at,created_at")
      .eq("meeting_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("public_meeting_contributions")
      .select("id,contribution_type,song_id,custom_title,custom_text,is_backup,contributor_name,notes,created_at,songs(id,title,default_key,bpm)")
      .eq("meeting_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
  ]);

  if (!meeting) notFound();

  let recentUsageRows: unknown = [];
  const { data: scopedRecentUsageRows, error: scopedRecentUsageError } = await supabase.rpc("get_song_recent_usage_excluding_meeting", {
    days_back: 30,
    excluded_meeting_id: id
  });

  if (scopedRecentUsageError) {
    const { data: fallbackRecentUsageRows } = await supabase.rpc("get_song_recent_usage", { days_back: 30 });
    recentUsageRows = fallbackRecentUsageRows || [];
  } else {
    recentUsageRows = scopedRecentUsageRows || [];
  }

  const typedItems = ((items || []) as MeetingProgramItem[]);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const activeLink = (shareLinks || []).find((link: any) => link.is_active);
  const publicUrl = activeLink ? `${siteUrl}/program/${activeLink.public_slug}` : null;
  const recentUsage = buildRecentUsageMap(recentUsageRows);
  const pendingContributions = ((publicContributions || []) as unknown as PublicMeetingContribution[]);

  return (
    <>
      <div className="top-row print-hide">
        <div>
          <div className="eyebrow">Program</div>
          <h1>{meeting.title}</h1>
          <p className="muted">{formatDateTime(meeting.meeting_date)}</p>
        </div>
        <div className="inline-form">
          <PrintButton />
          <Link className="btn secondary" href="/meetings">Înapoi</Link>
        </div>
      </div>

      <div className="grid grid-2 meeting-layout">
        <section className="card grid print-card">
          <div className="top-row program-toolbar" style={{ marginBottom: 0 }}>
            <div>
              <h2>Lista programului</h2>
              <p className="muted small">Listă compactă, ordonabilă prin drag & drop sau săgeți.</p>
            </div>
            <div className="inline-form print-hide">
              {activeLink ? <a className="btn secondary btn-compact" href={`/program/${activeLink.public_slug}`} target="_blank">Vezi public</a> : null}
              <PrintButton label="Print" />
            </div>
          </div>

          <div className="print-only print-program-title">
            <h1>{meeting.title}</h1>
            <p>{formatDateTime(meeting.meeting_date)}</p>
          </div>

          <MeetingProgramBoard meetingId={meeting.id} items={typedItems} recentUsage={recentUsage} />
        </section>

        <aside className="grid print-hide">
          {pendingContributions.length > 0 ? (
            <section className="card external-proposals-section">
              <div className="eyebrow external-eyebrow">Propuneri externe</div>
              <h2>Adăugate din link public</h2>
              <p className="muted small">Aceste elemente sunt evidențiate cu roșu și intră în program doar după ce le accepți.</p>
              <div className="grid compact-list">
                {pendingContributions.map((item) => <ExternalContributionCard key={item.id} meetingId={meeting.id} item={item} />)}
              </div>
            </section>
          ) : null}

          <AddSongsPanel meetingId={meeting.id} recentUsage={recentUsage} />

          <section className="card">
            <h2>Adaugă element între cântări</h2>
            <p className="muted small">După adăugare îl poți muta exact unde dorești cu drag & drop sau cu săgețile din listă.</p>
            <form action={addTextItemAction} className="form-grid">
              <input type="hidden" name="meeting_id" value={meeting.id} />
              <label className="label">Tip
                <select className="select" name="item_type" defaultValue="text">
                  <option value="text">Poezie</option>
                  <option value="prayer">Rugăciune</option>
                  <option value="encouragement">Îndemn</option>
                  <option value="message">Mesaj</option>
                  <option value="break">Pauză</option>
                </select>
              </label>
              <label className="label">Titlu
                <input className="input" name="custom_title" placeholder="Poezie / Rugăciune / Îndemn / Mesaj" />
              </label>
              <label className="label">Text
                <textarea className="textarea" name="custom_text" placeholder="Detalii afișate în program" />
              </label>
              <button className="btn" type="submit">Adaugă element</button>
            </form>
          </section>

          <section className="card">
            <h2>Share public</h2>
            {activeLink && publicUrl ? (
              <div className="grid">
                <div className="share-box">
                  <a href={`/program/${activeLink.public_slug}`} target="_blank" rel="noreferrer">{publicUrl}</a>
                </div>
                <div className="inline-form">
                  <CopyButton text={publicUrl} />
                  <a className="btn secondary btn-compact" href={`/program/${activeLink.public_slug}`} target="_blank">Deschide</a>
                </div>
                <form action={deleteShareLinkAction}>
                  <input type="hidden" name="meeting_id" value={meeting.id} />
                  <input type="hidden" name="link_id" value={activeLink.id} />
                  <button className="btn secondary btn-compact" type="submit">Dezactivează/șterge linkul</button>
                </form>
              </div>
            ) : (
              <p className="muted">Nu există link public activ.</p>
            )}
            <form action={createShareLinkAction} className="form-grid">
              <input type="hidden" name="meeting_id" value={meeting.id} />
              <label className="label">Slug opțional
                <input className="input" name="preferred_slug" placeholder="duminica-dimineata" />
              </label>
              <button className="btn secondary" type="submit">Generează link public</button>
            </form>
          </section>

          <section className="card danger-card">
            <div className="badge danger-badge">Zonă de ștergere</div>
            <h2>Șterge programul</h2>
            <p className="muted small">Șterge programul, toate elementele din listă și linkurile publice asociate.</p>
            <form action={deleteMeetingAction} className="form-grid">
              <input type="hidden" name="meeting_id" value={meeting.id} />
              <label className="label">Confirmare
                <input className="input" name="confirm" placeholder="scrie: STERGE" />
              </label>
              <button className="btn danger" type="submit">Șterge programul</button>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
