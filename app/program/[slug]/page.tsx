import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { PrintButton } from "@/components/PrintButton";
import { PublicContributionPanel } from "@/components/PublicContributionPanel";
import { PublicTextContributionForm } from "@/components/PublicTextContributionForm";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

type PageProps = { params: Promise<{ slug: string }> };

type PublicMeetingItem = {
  position: number;
  item_type: string;
  is_backup: boolean;
  custom_title: string | null;
  custom_text: string | null;
  selected_key: string | null;
  selected_bpm: number | null;
  notes: string | null;
  song: null | {
    title: string;
    lyrics_text: string | null;
    default_key: string | null;
    bpm: number | null;
    structure: string | null;
    source_summary?: string | null;
  };
};


type PublicContribution = {
  id: string;
  created_at: string;
  reviewed_at?: string | null;
  contribution_type: string;
  status: string;
  proposed_position?: number | null;
  is_backup: boolean;
  custom_title: string | null;
  custom_text: string | null;
  contributor_name: string | null;
  notes: string | null;
  song: null | {
    title: string;
    lyrics_text: string | null;
    default_key: string | null;
    bpm: number | null;
    structure: string | null;
    source_summary?: string | null;
  };
};

const itemTypeLabels: Record<string, string> = {
  text: "Poezie",
  prayer: "Rugăciune",
  encouragement: "Îndemn",
  message: "Mesaj",
  break: "Pauză",
  song: "Cântare"
};

function sourceBadge(song?: { source_summary?: string | null } | null) {
  return song?.source_summary ? <span className="badge">{song.source_summary}</span> : null;
}

function LyricsDetails({ text }: { text?: string | null }) {
  const cleanText = (text || "").trim();
  if (!cleanText) return null;
  return (
    <details className="public-program-lyrics-details">
      <summary>Vezi versurile</summary>
      <pre>{cleanText}</pre>
    </details>
  );
}

function PublicItem({ item, index }: { item: PublicMeetingItem; index: number }) {
  return (
    <div className={`public-program-item ${item.is_backup ? "public-backup-item" : ""}`}>
      <div className="program-position">{index + 1}</div>
      <div className="program-main">
        <div className="program-title public-program-title-compact">{item.song?.title || item.custom_title || "Element"}</div>
        <div className="badges compact-badges">
          <span className="badge">{item.song ? "Cântare" : (itemTypeLabels[item.item_type] || "Element")}</span>
          {sourceBadge(item.song)}
          {item.is_backup ? <span className="badge backup">backup</span> : null}
          {item.song && (item.selected_key || item.song.default_key) ? <span className="badge">Tonalitate: {item.selected_key || item.song.default_key}</span> : null}
          {item.song && (item.selected_bpm || item.song.bpm) ? <span className="badge">{item.selected_bpm || item.song.bpm} BPM</span> : null}
        </div>
        {item.song ? <LyricsDetails text={item.song.lyrics_text} /> : <LyricsDetails text={item.custom_text} />}
        {item.notes ? <p className="muted small public-item-notes">{item.notes}</p> : null}
      </div>
    </div>
  );
}

function PublicContributionItem({ item, index }: { item: PublicContribution; index: number }) {
  const title = item.song?.title || item.custom_title || "Propunere";
  const statusLabel = item.status === "accepted" ? "acceptată" : item.status === "rejected" ? "respinsă" : "în așteptare";
  return (
    <div className={`public-program-item public-external-item public-external-item-${item.status}`}>
      <div className="program-position external-position">E{index + 1}</div>
      <div className="program-main">
        <div className="program-title public-program-title-compact">{title}</div>
        <div className="badges compact-badges">
          <span className="badge external-badge">propusă extern</span>
          <span className="badge">{statusLabel}</span>
          <span className="badge">{item.song ? "Cântare" : (itemTypeLabels[item.contribution_type] || "Element")}</span>
          {sourceBadge(item.song)}
          {item.proposed_position ? <span className="badge">poziție propusă: {item.proposed_position}</span> : null}
          {item.is_backup ? <span className="badge backup">backup</span> : null}
          {item.contributor_name ? <span className="badge">{item.contributor_name}</span> : null}
          {item.song?.default_key ? <span className="badge">Tonalitate: {item.song.default_key}</span> : null}
        </div>
        {item.song ? <LyricsDetails text={item.song.lyrics_text} /> : <LyricsDetails text={item.custom_text} />}
        {item.notes ? <p className="muted small public-item-notes">{item.notes}</p> : null}
        <p className="muted small public-history-time">Trimisă: {formatDateTime(item.created_at)}{item.reviewed_at ? ` · Procesată: ${formatDateTime(item.reviewed_at)}` : ""}</p>
      </div>
    </div>
  );
}

function buildPositionOptions(items: PublicMeetingItem[]) {
  const main = items.filter((item) => !item.is_backup).sort((a, b) => a.position - b.position);
  const options = [{ value: "1", label: "La început" }];
  main.forEach((item, index) => {
    const title = item.song?.title || item.custom_title || itemTypeLabels[item.item_type] || "Element";
    options.push({ value: String(index + 2), label: `După ${index + 1}. ${title}` });
  });
  return options;
}

export default async function PublicProgramPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_meeting", { p_public_slug: slug });

  if (error || !data) notFound();

  const meeting = (data as any).meeting;
  const items = (((data as any).items || []) as PublicMeetingItem[]).sort((a, b) => a.position - b.position);
  const mainItems = items.filter((item) => !item.is_backup);
  const backupItems = items.filter((item) => item.is_backup);
  const contributions = (((data as any).contributions || []) as PublicContribution[]);
  const contributionHistory = (((data as any).contribution_history || []) as PublicContribution[]);
  const positionOptions = buildPositionOptions(items);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const publicUrl = `${siteUrl}/program/${slug}`;

  return (
    <main className="public-page public-page-v10">
      <header className="public-header public-header-v10">
        <div>
          <div className="eyebrow">Program public</div>
          <h1>{meeting.title}</h1>
          <p>{formatDateTime(meeting.meeting_date)}</p>
        </div>
        <div className="inline-form print-hide">
          <CopyButton text={publicUrl} />
          <PrintButton />
        </div>
      </header>

      <section className="card public-program-card">
        <div className="program-group-header">
          <div>
            <div className="eyebrow">Ordinea programului</div>
            <h2>Program principal</h2>
          </div>
        </div>
        <div className="public-program-list">
          {mainItems.length === 0 ? <p className="muted">Programul nu conține încă elemente publice.</p> : null}
          {mainItems.map((item, index) => <PublicItem key={`${item.position}-${item.item_type}-${index}`} item={item} index={index} />)}
        </div>

        {backupItems.length > 0 ? (
          <div className="public-backup-block">
            <div className="eyebrow">Cântări backup</div>
            <div className="public-program-list">
              {backupItems.map((item, index) => <PublicItem key={`backup-${item.position}-${index}`} item={item} index={index} />)}
            </div>
          </div>
        ) : null}

        {contributions.length > 0 ? (
          <div className="public-external-block">
            <div className="eyebrow external-eyebrow">Propuneri externe neaprobate</div>
            <div className="public-program-list">
              {contributions.map((item, index) => <PublicContributionItem key={item.id} item={item} index={index} />)}
            </div>
          </div>
        ) : null}
      </section>

      <PublicContributionPanel slug={slug} positionOptions={positionOptions} />

      <PublicTextContributionForm slug={slug} positionOptions={positionOptions} />

      {contributionHistory.length > 0 ? (
        <details className="card public-program-card print-hide history-toggle-card">
          <summary className="history-toggle-summary">
            <span>Vezi istoricul propunerilor</span>
            <span className="badge">{contributionHistory.length}</span>
          </summary>
          <div className="history-toggle-content">
            <div className="eyebrow">Istoric propuneri</div>
            <h2>Ultimele propuneri trimise</h2>
            <div className="public-program-list">
              {contributionHistory.map((item, index) => <PublicContributionItem key={item.id} item={item} index={index} />)}
            </div>
          </div>
        </details>
      ) : null}
    </main>
  );
}
