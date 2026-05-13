import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExternalSourcesSyncPanel } from "@/components/ExternalSourcesSyncPanel";
import { deleteResurseExternalSongsAction } from "./actions";

export default async function ExternalSourcesPage() {
  const supabase = await createClient();
  const [{ data: sources }, { data: runs }, { data: recentRefs }, { count: totalImported }] = await Promise.all([
    supabase.from("external_sources").select("id,name,slug,base_url,license_label,permission_notes,last_synced_at,collection_id,song_collections(name,short_code)").eq("slug", "resursecrestine").order("name"),
    supabase.from("external_sync_runs").select("id,status,pages_scanned,found_count,imported_count,updated_count,skipped_count,error_message,started_at,finished_at,external_sources!inner(name,slug)").eq("external_sources.slug", "resursecrestine").order("started_at", { ascending: false }).limit(2),
    supabase
      .from("external_song_refs")
      .select("id,external_title,external_url,last_imported_at,last_seen_at,songs(id,title),external_sources!inner(slug,name)")
      .eq("external_sources.slug", "resursecrestine")
      .order("last_imported_at", { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from("external_song_refs")
      .select("id,external_sources!inner(slug)", { count: "exact", head: true })
      .eq("external_sources.slug", "resursecrestine")
  ]);

  return (
    <>
      <div className="top-row">
        <div>
          <div className="eyebrow">Setări · sincronizare bibliotecă</div>
          <h1>Surse externe</h1>
          <p className="muted">Sincronizează cântări din Resurse Creștine. Salvăm în cântare doar titlul și versurile.</p>
        </div>
        <div className="inline-form">
          <Link className="btn secondary" href="/collections">Colecții</Link>
          <Link className="btn" href="/songs">Toate cântările</Link>
        </div>
      </div>

      <ExternalSourcesSyncPanel initialRuns={(runs || []) as any} />

      <section className="card compact-card" style={{ marginTop: 16 }}>
        <h2>Surse configurate</h2>
        <div className="list compact-list">
          {(sources || []).map((source: any) => (
            <div className="row compact-row" key={source.id}>
              <span className="row-main">
                <span className="row-title">{source.name}</span>
                <span className="muted small">{source.base_url} · titlu + versuri</span>
                <span className="muted small">Colecție: {source.song_collections?.name || "nelegată"} · Ultima sincronizare: {source.last_synced_at ? new Date(source.last_synced_at).toLocaleString("ro-RO") : "niciodată"}</span>
              </span>
              {source.collection_id ? <Link className="btn secondary btn-compact" href={`/songs?collection=${source.collection_id}`}>Vezi colecția</Link> : null}
            </div>
          ))}
          {(!sources || sources.length === 0) ? <p className="muted">Rulează SQL-ul pentru surse externe, apoi revino aici. Momentan este activă doar sursa Resurse Creștine.</p> : null}
        </div>
      </section>

      <section className="card compact-card" style={{ marginTop: 16 }}>
        <div className="section-header-row">
          <div>
            <h2>Cântări preluate recent</h2>
            <p className="muted small">Total în colecția externă: {totalImported || 0}. Afișăm ultimele 20 sincronizate.</p>
          </div>
          <Link className="btn secondary btn-compact" href="/songs">Filtrează în Toate cântările</Link>
        </div>
        <div className="list compact-list">
          {(recentRefs || []).map((ref: any) => (
            <div className="row compact-row" key={ref.id}>
              <span className="row-main">
                <Link className="row-title" href={`/songs/${ref.songs?.id}`}>{ref.songs?.title || ref.external_title || "Cântare externă"}</Link>
                <span className="muted small">Import: {ref.last_imported_at ? new Date(ref.last_imported_at).toLocaleString("ro-RO") : "—"} · Văzută: {ref.last_seen_at ? new Date(ref.last_seen_at).toLocaleString("ro-RO") : "—"}</span>
              </span>
              {ref.external_url ? <a className="btn secondary btn-compact" href={ref.external_url} target="_blank" rel="noreferrer">Sursa</a> : null}
            </div>
          ))}
          {(!recentRefs || recentRefs.length === 0) ? <p className="muted">Nu există încă importuri din Resurse Creștine.</p> : null}
        </div>
      </section>

      <section className="card danger-card compact-card" style={{ marginTop: 16 }}>
        <h2>Curățare import Resurse Creștine</h2>
        <p className="muted small">Folosește această acțiune dacă un import extern a fost greșit și vrei să refaci sincronizarea. Șterge cântările legate de Resurse Creștine și referințele externe asociate. Nu șterge userii sau celelalte colecții.</p>
        <form action={deleteResurseExternalSongsAction} className="inline-form" style={{ marginTop: 10 }}>
          <input className="input" name="confirmation" placeholder="Scrie STERGE RESURSE" />
          <button className="btn danger btn-compact" type="submit">Șterge importul Resurse</button>
        </form>
      </section>
    </>
  );
}
