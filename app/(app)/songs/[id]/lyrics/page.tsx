import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SongSectionsEditor } from "@/components/SongSectionsEditor";
import { updateSongLyricsAction } from "../../actions";

type PageProps = { params: Promise<{ id: string }> };

function statusLabel(status?: string | null) {
  if (status === "approved") return "Verificat";
  if (status === "needs_review") return "Necesită verificare";
  if (status === "parsed") return "Extras automat";
  if (status === "failed") return "Import eșuat";
  if (status === "pending") return "În așteptare";
  return "Fără status";
}

function splitLyricsFallback(text?: string | null) {
  if (!text) return [];
  return text
    .split(/\n\s*\n/g)
    .map((content, index) => ({
      id: `fallback-${index}`,
      section_type: index === 1 ? "chorus" : "verse",
      section_label: index === 1 ? "R" : String(index + 1),
      content: content.trim()
    }))
    .filter((section) => section.content.length > 0);
}

export default async function SongLyricsReviewPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: song }, { data: sections }, { data: files }, { data: sources }] = await Promise.all([
    supabase.from("songs").select("id,title,structure,lyrics_text").eq("id", id).single(),
    supabase.from("song_sections").select("id,section_type,section_label,position,content").eq("song_id", id).order("position"),
    supabase.from("song_files").select("id,file_name,import_status,parsed_text,parser_notes,created_at").eq("song_id", id).order("created_at", { ascending: false }),
    supabase.from("song_sources").select("song_number,source_title,song_collections(name,short_code)").eq("song_id", id)
  ]);

  if (!song) notFound();

  const sourceFile = (files || [])[0] as any;
  const initialSections = (sections && sections.length > 0) ? sections : splitLyricsFallback(song.lyrics_text);
  const importStatus = sourceFile?.import_status || "needs_review";

  return (
    <>
      <div className="top-row">
        <div>
          <div className="eyebrow">Verificare import / versuri</div>
          <h1>{song.title}</h1>
          <div className="badges" style={{ marginTop: 12 }}>
            {(sources || []).map((source: any, index: number) => (
              <span className="badge" key={index}>
                {source.song_collections?.short_code || source.song_collections?.name || "Sursă"}{source.song_number ? ` nr. ${source.song_number}` : ""}
              </span>
            ))}
            <span className={importStatus === "approved" ? "badge" : "badge warning"}>{statusLabel(importStatus)}</span>
          </div>
        </div>
        <div className="inline-form">
          <Link className="btn secondary" href="/review">Importuri</Link>
          <Link className="btn secondary" href={`/songs/${song.id}`}>Înapoi la cântare</Link>
        </div>
      </div>

      <form action={updateSongLyricsAction} className="grid review-layout">
        <input type="hidden" name="song_id" value={song.id} />

        <section className="card form-grid">
          <h2>Date principale</h2>
          <label className="label">Titlu
            <input className="input" name="title" defaultValue={song.title} required />
          </label>
          <label className="label">Structură
            <input className="input" name="structure" defaultValue={song.structure || ""} placeholder="ex: V1, R, V2, R" />
          </label>
          <label className="label">Status import
            <select className="select" name="import_status" defaultValue={importStatus}>
              <option value="needs_review">Necesită verificare</option>
              <option value="approved">Verificat / aprobat</option>
              <option value="parsed">Extras automat</option>
              <option value="pending">În așteptare</option>
              <option value="failed">Import eșuat</option>
            </select>
          </label>
          <div className="inline-form">
            <button className="btn" type="submit">Salvează versurile</button>
            <label className="check-inline">
              <input type="checkbox" name="go_back_to_review" />
              <span>după salvare, revino la importuri</span>
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Fișier importat</h2>
          {sourceFile ? (
            <div className="grid">
              <div className="card-soft">
                <strong>{sourceFile.file_name}</strong>
                <p className="muted small">Status: {statusLabel(sourceFile.import_status)}</p>
                {sourceFile.parser_notes ? <p className="small">{sourceFile.parser_notes}</p> : null}
              </div>
              <details className="raw-import-box">
                <summary>Vezi textul brut extras din PPT/PDF/TXT</summary>
                <pre>{sourceFile.parsed_text || "Nu există text brut salvat."}</pre>
              </details>
            </div>
          ) : (
            <p className="muted">Această cântare nu are fișier importat asociat. Poți totuși edita versurile.</p>
          )}
        </section>

        <section className="card review-main-card">
          <SongSectionsEditor sections={initialSections as any[]} songTitle={song.title} />
        </section>
      </form>
    </>
  );
}
