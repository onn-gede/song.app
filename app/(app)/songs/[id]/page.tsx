import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddSongToMeeting } from "@/components/AddSongToMeeting";
import { DeleteSongButton } from "@/components/DeleteSongButton";
import { buildStableBibleSourceUrl } from "@/lib/freeBibleText";
import { stripRepeatedSongTitleLines } from "@/lib/songTextCleanup";

type PageProps = { params: Promise<{ id: string }> };

function stableReferenceUrl(ref: any) {
  const sourceUrl = ref?.source_url as string | null | undefined;
  if (sourceUrl && !sourceUrl.includes("bible-api.com")) return sourceUrl;
  if (ref?.book && ref?.chapter && ref?.verse_start) {
    return buildStableBibleSourceUrl(ref.book, Number(ref.chapter), Number(ref.verse_start), ref.verse_end ? Number(ref.verse_end) : null);
  }
  return sourceUrl || "https://archive.org/details/bibliacornilescu1921";
}

function sourceLink(ref: any, label: string | null | undefined) {
  if (!label) return null;
  const href = stableReferenceUrl(ref);
  return (
    <a href={href} target="_blank" rel="noreferrer" className="reference-link">
      {label}
    </a>
  );
}

export default async function SongDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: song }, { data: sections }, { data: sources }, { data: refs }, { data: cats }, { data: files }] = await Promise.all([
    supabase.from("songs").select("*").eq("id", id).single(),
    supabase.from("song_sections").select("*").eq("song_id", id).order("position"),
    supabase.from("song_sources").select("song_number,source_title,song_collections(id,name,short_code)").eq("song_id", id),
    supabase.from("song_bible_references").select("id,theme,reason,confidence,bible_references(version,book,chapter,verse_start,verse_end,reference_label,text_cache,source_url)").eq("song_id", id),
    supabase.from("song_categories").select("categories(id,name,slug)").eq("song_id", id),
    supabase.from("song_files").select("id,file_name,import_status,parser_notes,created_at").eq("song_id", id).order("created_at", { ascending: false })
  ]);

  if (!song) notFound();

  const sourceFile = (files || [])[0] as any;
  const importStatus = sourceFile?.import_status;
  const importStatusLabel = importStatus === "approved" ? "Import verificat" : importStatus === "needs_review" ? "Import de verificat" : importStatus ? `Import: ${importStatus}` : null;
  const sourceNumbers = (sources || []).map((source: any) => String(source.song_number || "")).filter(Boolean);
  const topSourceLabels = (sources || [])
    .map((source: any) => {
      const collection = source.song_collections?.short_code || source.song_collections?.name || "Sursă";
      return source.song_number ? `${collection} nr. ${source.song_number}` : collection;
    })
    .filter(Boolean);

  return (
    <>
      <div className="song-detail-header">
        <div className="song-title-block">
          <div className="eyebrow">Cântare</div>
          <h1 className="single-line-title" title={song.title}>{song.title}</h1>
          <div className="badges song-meta-line">
            {topSourceLabels.slice(0, 3).map((label: string) => <span className="badge strong-badge" key={label}>{label}</span>)}
            {song.default_key ? <span className="badge">Tonalitate: {song.default_key}</span> : <span className="badge muted-badge">Tonalitate nesetată</span>}
            {song.bpm ? <span className="badge">{song.bpm} BPM</span> : null}
            {song.structure ? <span className="badge">Structură: {song.structure}</span> : null}
            {importStatusLabel ? <Link className={importStatus === "approved" ? "badge" : "badge warning"} href={`/songs/${song.id}/lyrics`}>{importStatusLabel}</Link> : null}
          </div>
        </div>
        <div className="song-actions-compact">
          <Link className="btn secondary btn-compact" href="/songs">Înapoi</Link>
          <Link className="btn secondary btn-compact" href={`/songs/${song.id}/edit`}>Editează</Link>
          <Link className="btn secondary btn-compact" href={`/songs/${song.id}/lyrics`}>Versuri</Link>
          <Link className="btn secondary btn-compact" href={`/songs/${song.id}/verses`}>Versete</Link>
          <Link className="btn secondary btn-compact" href={`/songs/${song.id}/present`}>Prezentare</Link>
          <AddSongToMeeting songId={song.id} songTitle={song.title} />
        </div>
      </div>

      <div className="grid grid-2 song-detail-grid">
        <section className="card grid song-lyrics-card">
          <div className="inline-form" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ marginBottom: 0 }}>Versuri structurate</h2>
            <Link className="btn secondary btn-compact" href={`/songs/${song.id}/present`}>Deschide prezentarea</Link>
          </div>
          {(sections || []).length === 0 ? <p className="lyrics">{song.lyrics_text || "Nu există versuri."}</p> : null}
          {(sections || []).map((section: any) => {
            const cleanContent = stripRepeatedSongTitleLines(section.content, song.title, sourceNumbers);
            return (
              <div className="section song-section-card" key={section.id}>
                <div className="section-label">{section.section_label || section.section_type}</div>
                <div className="lyrics">{cleanContent || section.content}</div>
              </div>
            );
          })}
        </section>

        <aside className="grid song-side-panel">
          <section className="card">
            <div className="inline-form" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ marginBottom: 0 }}>Versete potrivite</h2>
              <Link className="btn secondary btn-compact" href={`/songs/${song.id}/verses`}>Gestionează</Link>
            </div>
            <div className="list" style={{ marginTop: 12 }}>
              {(refs || []).map((item: any, index: number) => {
                const ref = item.bible_references;
                return (
                  <div className="card-soft" key={index}>
                    {sourceLink(ref, ref?.reference_label)}
                    {item.theme ? <p className="muted small">Temă: {item.theme}</p> : null}
                    {ref?.text_cache ? <p className="bible-text">{ref.text_cache}</p> : <p className="muted small">Textul exact nu este salvat încă. Îl poți prelua/salva din pagina Versete.</p>}
                    {item.reason ? <p className="small">{item.reason}</p> : null}
                    <a className="small" href={stableReferenceUrl(ref)} target="_blank" rel="noreferrer">Deschide sursa originală</a>
                  </div>
                );
              })}
              {(!refs || refs.length === 0) ? <p className="muted">Nu există încă versete asociate.</p> : null}
            </div>
          </section>

          <section className="card">
            <h2>Surse</h2>
            <div className="badges">
              {(sources || []).map((source: any, index: number) => (
                <Link className="badge" key={index} href={source.song_collections?.id ? `/songs?collection=${source.song_collections.id}` : "/songs"}>
                  {source.song_collections?.name || "Sursă"}{source.song_number ? ` nr. ${source.song_number}` : ""}
                </Link>
              ))}
              {(!sources || sources.length === 0) ? <span className="muted">Fără sursă.</span> : null}
            </div>
          </section>

          <section className="card">
            <h2>Categorii</h2>
            <div className="badges">
              {(cats || []).map((item: any, index: number) => (
                <Link className="badge" key={index} href={item.categories?.id ? `/songs?category=${item.categories.id}` : "/songs"}>{item.categories?.name}</Link>
              ))}
              {(!cats || cats.length === 0) ? <span className="muted">Necategorizată.</span> : null}
            </div>
          </section>

          <section className="card">
            <h2>Import / verificare</h2>
            {sourceFile ? (
              <div className="grid">
                <div className="badges">
                  <span className={importStatus === "approved" ? "badge" : "badge warning"}>{importStatusLabel}</span>
                </div>
                <p className="muted small">{sourceFile.file_name}</p>
                {sourceFile.parser_notes ? <p className="small">{sourceFile.parser_notes}</p> : null}
                <Link className="btn secondary btn-compact" href={`/songs/${song.id}/lyrics`}>Deschide verificarea versurilor</Link>
              </div>
            ) : (
              <div className="grid">
                <p className="muted">Nu există fișier importat asociat.</p>
                <Link className="btn secondary btn-compact" href={`/songs/${song.id}/lyrics`}>Editează versurile manual</Link>
              </div>
            )}
          </section>
        </aside>
      </div>

      <DeleteSongButton songId={song.id} songTitle={song.title} />
    </>
  );
}
