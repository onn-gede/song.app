import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createCollectionAction, updateCollectionAction, deleteCollectionAction } from "./actions";

const sourceTypes = [
  ["manual", "Manual"],
  ["pptx", "PPTX"],
  ["ppt", "PPT"],
  ["pdf", "PDF"],
  ["txt", "Text"],
  ["docx", "DOCX"],
  ["other", "Alt format"]
];

export default async function CollectionsPage() {
  const supabase = await createClient();

  const [{ data: collections, error }, { data: sources }] = await Promise.all([
    supabase
      .from("song_collections")
      .select("id,name,short_code,description,source_type,is_active,created_at")
      .order("name"),
    supabase.from("song_sources").select("collection_id,song_id")
  ]);

  const counts = new Map<string, number>();
  const seenPairs = new Set<string>();
  (sources || []).forEach((source: any) => {
    const key = `${source.collection_id}:${source.song_id}`;
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    counts.set(source.collection_id, (counts.get(source.collection_id) || 0) + 1);
  });

  return (
    <>
      <div className="top-row">
        <div>
          <div className="eyebrow">Administrare bibliotecă</div>
          <h1>Colecții de cântări</h1>
          <p className="muted">Ține separat Tineri, Cântările Evangheliei, colinde sau orice altă bază importată.</p>
        </div>
        <div className="inline-form">
          <Link className="btn secondary" href="/import">Import text</Link>
          <Link className="btn" href="/songs">Toate cântările</Link>
        </div>
      </div>

      <div className="grid collection-layout">
        <section className="card">
          <h2>Adaugă colecție</h2>
          <form action={createCollectionAction} className="form-grid">
            <label className="label">Nume colecție
              <input className="input" name="name" placeholder="ex: Cântările Evangheliei - carte roșie" required />
            </label>
            <div className="form-two">
              <label className="label">Cod scurt
                <input className="input" name="short_code" placeholder="ex: CE_ROSU" />
              </label>
              <label className="label">Tip sursă
                <select className="select" name="source_type" defaultValue="manual">
                  {sourceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <label className="label">Descriere
              <textarea className="textarea" name="description" placeholder="Detalii despre carte, sursă, ediție sau format." />
            </label>
            <button className="btn" type="submit">Creează colecția</button>
          </form>
        </section>

        <section className="card collection-main-card">
          <div className="top-row" style={{ marginBottom: 14 }}>
            <div>
              <h2>Colecții existente</h2>
              <p className="muted small">{collections?.length || 0} colecții · poți dezactiva o colecție fără să ștergi cântările.</p>
            </div>
          </div>
          {error ? <p className="error">{error.message}</p> : null}
          <div className="list">
            {(collections || []).map((collection: any) => (
              <details className="collection-card" key={collection.id}>
                <summary>
                  <span>
                    <strong>{collection.name}</strong>
                    <span className="badges compact-badges">
                      <span className="badge">{collection.short_code}</span>
                      <span className="badge">{collection.source_type}</span>
                      <span className="badge">{counts.get(collection.id) || 0} cântări</span>
                      {!collection.is_active ? <span className="badge warning">inactivă</span> : null}
                    </span>
                  </span>
                  <span className="muted small">Editează</span>
                </summary>
                <form action={updateCollectionAction} className="form-grid collection-edit-form">
                  <input type="hidden" name="collection_id" value={collection.id} />
                  <label className="label">Nume
                    <input className="input" name="name" defaultValue={collection.name} required />
                  </label>
                  <div className="form-two">
                    <label className="label">Cod scurt
                      <input className="input" name="short_code" defaultValue={collection.short_code} required />
                    </label>
                    <label className="label">Tip sursă
                      <select className="select" name="source_type" defaultValue={collection.source_type}>
                        {sourceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="label">Descriere
                    <textarea className="textarea" name="description" defaultValue={collection.description || ""} />
                  </label>
                  <label className="check-row compact-check-row">
                    <input type="checkbox" name="is_active" defaultChecked={collection.is_active} />
                    <span><strong>Colecție activă</strong><small>Apare în filtre și în formularele de import.</small></span>
                  </label>
                  <div className="inline-form">
                    <button className="btn" type="submit">Salvează</button>
                    <Link className="btn secondary" href={`/songs?collection=${collection.id}`}>Vezi cântările</Link>
                  </div>
                </form>
                <div className="danger-card subtle-danger">
                  <strong>Șterge colecția</strong>
                  <p className="muted small">Șterge colecția și legăturile de sursă. Cântările rămân în bibliotecă, dar fără această sursă.</p>
                  <form action={deleteCollectionAction} className="inline-form delete-inline-form">
                    <input type="hidden" name="collection_id" value={collection.id} />
                    <input className="input compact-confirm" name="confirm" placeholder="STERGE" />
                    <button className="btn danger btn-compact" type="submit">Șterge colecția</button>
                  </form>
                </div>
              </details>
            ))}
            {(!collections || collections.length === 0) ? <p className="muted">Nu există colecții încă.</p> : null}
          </div>
        </section>
      </div>
    </>
  );
}
