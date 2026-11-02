import { ProgramNotifications,ProgramNotificationsButton,ProgramNotificationsPanel } from "@/components/ProgramNotifications";
import Link from "next/link";
import { MeetingStatusBadge } from "@/components/MeetingStatus";
import { MeetingState } from "@/components/MeetingState";
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
import { ExportPackageButton } from "@/components/BackupTools";
import { PrintButton } from "@/components/PrintButton";
import { PresentationLaunchButton } from "@/components/PresentationLaunchButton";
import {
  setMeetingTemplateAction,
  setMeetingProgramKindAction,
  createShareLinkAction,
  setShareContributionsAction,
  deleteMeetingAction,
  deleteShareLinkAction,
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
  return ({ text: "Poezie", prayer: "Rugăciune", encouragement: "Îndemn", message: "Mesaj", break: "Pauză", other: "Diverse", song: "Cântare" } as Record<string, string>)[type] || "Element";
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
  const actorIds=Array.from(new Set([meeting.created_by,meeting.last_modified_by].filter(Boolean))) as string[];
  const {data:programActors}=actorIds.length?await supabase.from("profiles").select("id,full_name,role").in("id",actorIds):{data:[] as any[]};
  const actorLabel=(actorId:string|null|undefined)=>{const actor=(programActors||[]).find((row:any)=>row.id===actorId);return actor?.full_name?.trim()||(actor?.role==='admin'?"Administrator":actor?"Utilizator":"Sistem / utilizator indisponibil");};

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
    <MeetingState key={id} meetingId={id} initial={initial}><ProgramNotifications enabled={editable} meetingId={id} initial={editable?pendingContributions:[]}>
      <div className="top-row page-heading-v44 print-hide">
        <div>
          <div className="eyebrow">Pregătirea întâlnirii</div>
          <div className="meeting-title-date"><h1>{meeting.title}</h1><time className="meeting-date-prominent" dateTime={meeting.meeting_date}>{formatDateTime(meeting.meeting_date)}</time></div>
          <div className="meeting-heading-badges"><MeetingStatusBadge date={meeting.meeting_date} status={meeting.status} template={meeting.is_template} initialNow={Date.now()}/><span className="program-kind-text">{meeting.program_kind==='rehearsal'?'Repetiție':'Program oficial'}</span></div>
          <p className="program-authorship"><span>Creat de <strong>{actorLabel(meeting.created_by)}</strong> · {formatDateTime(meeting.created_at)}</span><span>Ultima modificare: <strong>{actorLabel(meeting.last_modified_by)}</strong> · {formatDateTime(meeting.last_modified_at||meeting.updated_at)}</span></p>
        </div>
        <div className="inline-form">
          {editable?<ProgramNotificationsButton/>:null}
          {activeLink ? <a className="btn public-highlight" href={`/program/${activeLink.public_slug}`} target="_blank" rel="noreferrer">Vezi public ↗</a> : null}
          <details className="program-page-tools"><summary title="Acțiuni program" aria-label="Acțiuni program">•••</summary><div className="program-tools-menu">
            <PresentationLaunchButton href={`/meetings/${id}/present`} label="Prezintă programul"/><PrintButton /><ExportPackageButton meetingId={id} /><Link className="btn secondary" href="/meetings">Înapoi la programe</Link>
          </div></details>
        </div>
      </div>

      {editable?<ProgramNotificationsPanel/>:null}
      <MeetingPrintDocument title={meeting.title} date={meeting.meeting_date} programKind={meeting.program_kind} principal={meeting.principal_responsible || null} secondary={meeting.secondary_responsibles || []} items={typedItems} />
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

          {editable ? <AddSongsPanel key={meeting.id} meetingId={meeting.id} recentUsage={recentUsage} initiallyOpen={true} /> : null}
          <MeetingProgramBoard meetingId={meeting.id} items={typedItems} recentUsage={recentUsage} canManage={editable} />
        </section>

        {editable ? <details className="program-secondary card print-hide"><summary>Partajare și administrare</summary><aside className="grid">
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
                <form action={setShareContributionsAction} className="inline-form"><input type="hidden" name="meeting_id" value={meeting.id}/><input type="hidden" name="link_id" value={activeLink.id}/><label><input type="checkbox" name="allow_contributions" defaultChecked={activeLink.allow_contributions}/> Permite propuneri de la vizitatori</label><button className="btn secondary">Salvează accesul</button></form>
                <form action={deleteShareLinkAction}>
                  <input type="hidden" name="meeting_id" value={meeting.id} />
                  <input type="hidden" name="link_id" value={activeLink.id} />
                  <button className="btn secondary btn-compact" type="submit">Dezactivează/șterge linkul</button>
                </form>
              </div>
            ) : (
              <p className="muted">Nu există link public activ.</p>
            )}
            {!activeLink ? <form action={createShareLinkAction} className="form-grid">
              <input type="hidden" name="meeting_id" value={meeting.id} />
              <label className="label">Slug opțional
                <input className="input" name="preferred_slug" placeholder="duminica-dimineata" />
              </label>
              <label><input type="checkbox" name="allow_contributions" defaultChecked/> Permite propuneri de la vizitatori</label><button className="btn secondary" type="submit">Generează link public</button>
            </form> : null}
            <p className="muted small">Setarea controlează propunerile vizitatorilor. Utilizatorii cu drepturi de editare pot modifica programul oricând.</p>
          </div></details>

          <details className="card program-administration"><summary>Setări și administrare</summary><div className="program-option-content administration-layout-v79">
          <section className="admin-setting-card"><div><div className="eyebrow">Tipul programului</div><h3>{meeting.program_kind==='rehearsal'?'Repetiție':'Program oficial'}</h3><p>{meeting.program_kind==='rehearsal'?'Cântările nu intră în istoric sau statistici. Îl poți transforma în program oficial.':'Cântările intră în istoric și statistici. Îl poți transforma în repetiție.'}</p></div><form action={setMeetingProgramKindAction}><input type="hidden" name="meeting_id" value={id}/><input type="hidden" name="program_kind" value={meeting.program_kind==='rehearsal'?'official':'rehearsal'}/><button className="btn secondary" type="submit">{meeting.program_kind==='rehearsal'?'Transformă în program oficial':'Transformă în repetiție'}</button></form></section>
          <section className="admin-setting-card"><div><div className="eyebrow">Șablon</div><h3>Reutilizează structura</h3><p>Șabloanele păstrează ordinea pentru întâlnirile viitoare și apar separat.</p></div><form action={setMeetingTemplateAction}><input type="hidden" name="meeting_id" value={id}/><input type="hidden" name="is_template" value={String(!meeting.is_template)}/><button className="btn secondary">{meeting.is_template?"Scoate din șabloane":"Păstrează ca șablon"}</button></form></section>
          <section className="admin-setting-card administration-copy"><DuplicateMeetingForm meetingId={id} title={meeting.title}/></section>
          <details className="admin-setting-card program-option-panel danger-card"><summary>Ștergere program</summary><div className="program-option-content">
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
    </ProgramNotifications></MeetingState>
  );
}
