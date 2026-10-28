import Link from "next/link";
import { MeetingState, MeetingActionForm } from "@/components/MeetingState";
import { meetingStatus } from "@/lib/meeting-state";
import type { MeetingSnapshot } from "@/lib/meeting-state";
import { MeetingResponsibles } from "@/components/MeetingResponsibles";
import { MeetingPrintDocument } from "@/components/MeetingPrintDocument";
import { notFound } from "next/navigation";
import { requireProfile, canEdit } from "@/lib/auth";
import { DuplicateMeetingForm } from "@/components/DuplicateMeetingForm";
import { formatDateTime } from "@/lib/format";
import { AddSongsPanel } from "@/components/AddSongsPanel";
import { CopyButton } from "@/components/CopyButton";
import { MeetingProgramBoard, type MeetingProgramItem } from "@/components/MeetingProgramBoard";
import { PrintButton } from "@/components/PrintButton";
import {
  acceptPublicContributionAction,
  addTextItemAction,
  setMeetingTemplateAction,
  createShareLinkAction,
  setShareContributionsAction,
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
  proposed_position: number | null;
  status: string;
  contributor_name: string | null;
  notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  songs: { id: string; title: string; default_key: string | null; bpm: number | null } | { id: string; title: string; default_key: string | null; bpm: number | null }[] | null;
};

function externalTypeLabel(type: string) {
  return ({ text: "Poezie", prayer: "Rugăciune", encouragement: "Îndemn", message: "Mesaj", break: "Pauză", song: "Cântare" } as Record<string, string>)[type] || "Element";
}

function ExternalContributionCard({ meetingId, item }: { meetingId: string; item: PublicMeetingContribution }) {
  const song = Array.isArray(item.songs) ? item.songs[0] : item.songs;
  const title = song?.title || item.custom_title || "Propunere externă";
  return (
    <div className="external-proposal-card external-proposal-card-v38">
      <div className="row-main">
        <div className="program-title">{title}</div>
        <div className="badges compact-badges">
          <span className="badge external-badge subtle-red-badge">propus extern</span>
          <span className="badge">{song ? "Cântare" : externalTypeLabel(item.contribution_type)}</span>
          {item.proposed_position ? <span className="badge">poziție propusă: {item.proposed_position}</span> : null}
          {item.is_backup ? <span className="badge backup">backup</span> : null}
          {item.contributor_name ? <span className="badge">{item.contributor_name}</span> : null}
          {song?.default_key ? <span className="badge">{song.default_key}</span> : null}
        </div>
        {item.custom_text ? <p className="lyrics compact-text-v10 external-proposal-text">{item.custom_text}</p> : null}
        {item.notes ? <p className="muted small compact-note-clean">{item.notes}</p> : null}
        <p className="muted small compact-note-clean">Trimisă: {formatDateTime(item.created_at)}</p>
      </div>
      <div className="inline-form nowrap external-actions-v38">
        <MeetingActionForm action={acceptPublicContributionAction}>
          <input type="hidden" name="meeting_id" value={meetingId} />
          <input type="hidden" name="contribution_id" value={item.id} />
          <button className="btn btn-compact" type="submit">Acceptă</button>
        </MeetingActionForm>
        <form action={rejectPublicContributionAction}>
          <input type="hidden" name="meeting_id" value={meetingId} />
          <input type="hidden" name="contribution_id" value={item.id} />
          <button className="btn secondary btn-compact" type="submit">Respinge</button>
        </form>
      </div>
    </div>
  );
}

function ExternalContributionHistoryCard({ item }: { item: PublicMeetingContribution }) {
  const song = Array.isArray(item.songs) ? item.songs[0] : item.songs;
  const title = song?.title || item.custom_title || "Propunere externă";
  const statusLabel = item.status === "accepted" ? "acceptată" : item.status === "rejected" ? "respinsă" : "în așteptare";
  return (
    <div className={`external-history-row external-history-${item.status}`}>
      <div>
        <strong>{title}</strong>
        <div className="badges compact-badges">
          <span className="badge">{statusLabel}</span>
          <span className="badge">{song ? "Cântare" : externalTypeLabel(item.contribution_type)}</span>
          {item.proposed_position ? <span className="badge">poziție: {item.proposed_position}</span> : null}
          {item.contributor_name ? <span className="badge">{item.contributor_name}</span> : null}
        </div>
      </div>
      <p className="muted small compact-note-clean">Trimisă: {formatDateTime(item.created_at)}{item.reviewed_at ? ` · Procesată: ${formatDateTime(item.reviewed_at)}` : ""}</p>
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
  const { supabase, profile } = await requireProfile();
  const editable = canEdit(profile.role);

  const [
    { data: meeting },
    { data: snapshot, error: snapshotError },
    { data: shareLinks },
    { data: publicContributions },
    { data: publicContributionHistory }
  ] = await Promise.all([
    supabase.from("meetings").select("*").eq("id", id).single(),
    supabase.rpc("get_meeting_snapshot_v46", { p_meeting_id: id }),
    supabase
      .from("meeting_share_links")
      .select("id,public_slug,is_active,expires_at,created_at,allow_contributions")
      .eq("meeting_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("public_meeting_contributions")
      .select("id,contribution_type,song_id,custom_title,custom_text,is_backup,proposed_position,status,contributor_name,notes,created_at,reviewed_at,songs(id,title,default_key,bpm)")
      .eq("meeting_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("public_meeting_contributions")
      .select("id,contribution_type,song_id,custom_title,custom_text,is_backup,proposed_position,status,contributor_name,notes,created_at,reviewed_at,songs(id,title,default_key,bpm)")
      .eq("meeting_id", id)
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(12)
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

  if (snapshotError || !snapshot) return <p className="error">Rulează UPDATE-V46.sql în proiectul Supabase existent pentru actualizarea programului.</p>;
  const initial = snapshot as MeetingSnapshot;
  const typedItems = initial.items;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const activeLink = (shareLinks || []).find((link: any) => link.is_active && (!link.expires_at || new Date(link.expires_at).getTime() > Date.now()));
  const publicUrl = activeLink ? `${siteUrl}/program/${activeLink.public_slug}` : null;
  const recentUsage = buildRecentUsageMap(recentUsageRows);
  const pendingContributions = ((publicContributions || []) as unknown as PublicMeetingContribution[]);
  const processedContributions = ((publicContributionHistory || []) as unknown as PublicMeetingContribution[]);

  return (
    <MeetingState key={id} initial={initial}>
      <div className="top-row page-heading-v44 print-hide">
        <div>
          <div className="eyebrow">Pregătirea întâlnirii</div>
          <h1>{meeting.title}</h1>
          {meetingStatus(meeting.meeting_date,meeting.status,meeting.is_template)==="finished" ? <span className="badge">Finalizat</span> : null}
          {meeting.is_template ? <span className="badge">Șablon</span> : null}
          <p className="muted">{formatDateTime(meeting.meeting_date)}</p>
        </div>
        <div className="inline-form">
          {activeLink ? <a className="btn public-highlight" href={`/program/${activeLink.public_slug}`} target="_blank" rel="noreferrer">Vezi public ↗</a> : null}
          <details className="program-page-tools"><summary title="Acțiuni program" aria-label="Acțiuni program">•••</summary><div className="program-tools-menu">
            <Link className="btn secondary" href={`/meetings/${id}/present`}>Prezintă programul</Link><PrintButton /><Link className="btn secondary" href="/meetings">Înapoi la programe</Link>
          </div></details>
        </div>
      </div>

      <MeetingPrintDocument title={meeting.title} date={meeting.meeting_date} principal={meeting.principal_responsible || null} secondary={meeting.secondary_responsibles || []} items={typedItems} />
      <div className="meeting-layout meeting-screen-layout meeting-v48">
        <section className="card print-card">
          <MeetingResponsibles meetingId={id} principal={meeting.principal_responsible || null} secondary={meeting.secondary_responsibles || []} editable={editable} />
          <div className="top-row program-toolbar" style={{ marginBottom: 0 }}>
            <div>
              <h2>Ordinea programului</h2>
            </div>

          </div>

          <div className="print-only print-program-title">
            <h1>{meeting.title}</h1>
          {meetingStatus(meeting.meeting_date,meeting.status,meeting.is_template)==="finished" ? <span className="badge">Finalizat</span> : null}
            <p>{formatDateTime(meeting.meeting_date)}</p>
          </div>

          {editable ? <details className="program-add-tray print-hide"><summary>+ Adaugă cântări</summary><AddSongsPanel meetingId={meeting.id} recentUsage={recentUsage} /></details> : null}
          <MeetingProgramBoard meetingId={meeting.id} items={typedItems} recentUsage={recentUsage} canManage={editable} />
        </section>

        {editable ? <details className="program-secondary card print-hide"><summary>Momente, partajare și administrare{pendingContributions.length ? ` · ${pendingContributions.length} propuneri` : ""}</summary><aside className="grid">
          {pendingContributions.length > 0 ? (
            <details className="card external-proposals-section"><summary>Propuneri externe ({pendingContributions.length})</summary>
              <div className="eyebrow external-eyebrow">Propuneri externe</div>
              <h2>Adăugate din link public</h2>
              <p className="muted small">Aceste elemente sunt evidențiate discret cu roșu și intră în program doar după ce le accepți. Poziția propusă este respectată automat când este posibil.</p>
              <div className="grid compact-list">
                {pendingContributions.map((item) => <ExternalContributionCard key={item.id} meetingId={meeting.id} item={item} />)}
              </div>
            </details>
          ) : null}



          {processedContributions.length > 0 ? (
            <details className="card external-proposals-section external-history-section history-toggle-card">
              <summary className="history-toggle-summary">
                <span>Vezi istoricul propunerilor</span>
                <span className="badge">{processedContributions.length}</span>
              </summary>
              <div className="history-toggle-content">
                <div className="eyebrow">Istoric propuneri</div>
                <h2>Procesate recent</h2>
                <div className="grid compact-list">
                  {processedContributions.map((item) => <ExternalContributionHistoryCard key={item.id} item={item} />)}
                </div>
              </div>
            </details>
          ) : null}


          <details className="card program-option-panel"><summary>Adaugă un moment în program</summary><div className="program-option-content">
            <h2>Adaugă element între cântări</h2>
            <MeetingActionForm action={addTextItemAction} className="form-grid">
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
            </MeetingActionForm>
          </div></details>

          <details className="card program-option-panel"><summary>Partajare și link public</summary><div className="program-option-content">
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
                <form action={setShareContributionsAction} className="inline-form"><input type="hidden" name="meeting_id" value={meeting.id}/><input type="hidden" name="link_id" value={activeLink.id}/><label><input type="checkbox" name="allow_contributions" defaultChecked={activeLink.allow_contributions}/> Permite propuneri externe</label><button className="btn secondary">Salvează accesul</button></form>
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
          </div></details>

          <details className="card program-administration"><summary>Administrare program</summary><div className="program-option-content">
          <DuplicateMeetingForm meetingId={id} title={meeting.title} />
          <form className="card" action={setMeetingTemplateAction}>
            <input type="hidden" name="meeting_id" value={id} /><input type="hidden" name="is_template" value={String(!meeting.is_template)} />
            <p className="muted small">Șabloanele păstrează structura pentru întâlnirile viitoare și apar separat de programele curente.</p>
            <button className="btn secondary">{meeting.is_template ? "Scoate din șabloane" : "Păstrează ca șablon"}</button>
          </form>
          <details className="card program-option-panel danger-card"><summary>Ștergere program</summary><div className="program-option-content">
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
          </div></details>
          </div></details>
        </aside></details> : null}
      </div>
    </MeetingState>
  );
}
