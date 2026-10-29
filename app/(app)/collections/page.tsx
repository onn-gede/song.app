import { SaveForm } from "@/components/SaveForm";
import Link from "next/link";
import { COLLECTION_PALETTE,collectionStyle } from "@/lib/collection-colors";
import { requireProfile, canEdit } from "@/lib/auth";
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
  const { supabase, profile } = await requireProfile();
  const editable = canEdit(profile.role);

  const [{ data: collections, error }, { data: sources, error: countsError }] = await Promise.all([
    supabase
      .from("song_collections")
      .select("id,name,short_code,description,source_type,is_active,created_at,color,opacity")
      .order("name"),
    supabase.rpc("collection_song_counts_v56")
  ]);

  const nextColor=COLLECTION_PALETTE.find(c=>!(collections||[]).some(v=>v.color===c))||COLLECTION_PALETTE[0];
  const counts = new Map<string,number>(((sources||[]) as {collection_id:string;song_count:number}[]).map(row=>[row.collection_id,Number(row.song_count)]));

  return (
    <>
      <div className="top-row">
        <div>
          <div className="eyebrow">Administrare bibliotecă</div>
          <h1>Colecții de cântări</h1>
          <p className="muted">Ține separat Tineri, Cântările Evangheliei, colinde sau orice altă bază importată.</p>
        </div>
        <div className="inline-form">
          {editable ? <><a className="btn secondary" href="/collections/youth-keys">Game cântări tineri ↗</a><Link className="btn secondary" href="/import">Import cântări</Link></> : null}
          <Link className="btn" href="/songs">Toate cântările</Link>
        </div>
      </div>

      <div className="grid collection-layout">
        {editable ? <section className="card">
          <h2>Adaugă colecție</h2>
          <SaveForm action={createCollectionAction} className="form-grid">
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
            <label className="label collection-color-control">Culoare<input type="color" name="color" defaultValue={nextColor}/></label>
            <label className="label">Intensitate culoare tag<select name="opacity" className="select" defaultValue="100">{[25,50,75,100].map(n=><option key={n} value={n}>{n}%</option>)}</select></label><label className="label">Descriere
              <textarea className="textarea" name="description" placeholder="Detalii despre carte, sursă, ediție sau format." />
            </label>
            <button className="btn" type="submit">Creează colecția</button>
          </SaveForm>
        </section> : null}

        <section className="card collection-main-card">
          <div className="top-row" style={{ marginBottom: 14 }}>
            <div>
              <h2>Colecții existente</h2>
              <p className="muted small">{collections?.length || 0} colecții · poți dezactiva o colecție fără să ștergi cântările.</p>
            </div>
          </div>
          {error ? <p className="error">{error.message}</p> : null}{countsError?<p className="error" role="alert">Numărătoarea nu a putut fi încărcată. Verifică UPDATE-V56.sql în baza existentă.</p>:null}
          <div className="list">
            {(collections || []).map((collection: any) => (
              <details className="collection-card collection-colored" key={JSON.stringify([collection.id,collection.name,collection.color,collection.opacity,collection.short_code,collection.description,collection.source_type,collection.is_active])} style={collectionStyle(collection)}>
                <summary>
                  <span>
                    <strong className="collection-title"><i className="collection-color-dot"/>{collection.name}</strong>
                    <span className="badges compact-badges">
                      <span className="badge">{collection.short_code}</span>
                      <span className="badge">{collection.source_type}</span>
                      <span className="badge">{countsError?"—":counts.get(collection.id) || 0} cântări</span>
                      {!collection.is_active ? <span className="badge warning">inactivă</span> : null}
                    </span>
                  </span>
                  <span className="muted small">{editable ? "Editează" : "Detalii"}</span>
                </summary>
                {editable ? <>
                <SaveForm action={updateCollectionAction} className="form-grid collection-edit-form">
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
                  <label className="label collection-color-control">Culoare<input type="color" name="color" defaultValue={collection.color}/></label>
                  <label className="label">Intensitate culoare tag<select name="opacity" className="select" defaultValue={collection.opacity||100}>{[25,50,75,100].map(n=><option key={n} value={n}>{n}%</option>)}</select></label><label className="label">Descriere
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
                </SaveForm>
                <div className="danger-card subtle-danger">
                  <strong>Șterge colecția</strong>
                  <p className="muted small">Șterge colecția și legăturile de sursă. Cântările rămân în bibliotecă, dar fără această sursă.</p>
                  <SaveForm action={deleteCollectionAction} className="inline-form delete-inline-form">
                    <input type="hidden" name="collection_id" value={collection.id} />
                    <input className="input compact-confirm" name="confirm" placeholder="STERGE" />
                    <button className="btn danger btn-compact" type="submit">Șterge colecția</button>
                  </SaveForm>
                </div>
                </> : <Link className="btn secondary" href={`/songs?collection=${collection.id}`}>Vezi cântările</Link>}
              </details>
            ))}
            {(!collections || collections.length === 0) ? <p className="muted">Nu există colecții încă.</p> : null}
          </div>
        </section>
      </div>
    </>
  );
}
