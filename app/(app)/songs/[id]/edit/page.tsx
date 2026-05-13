import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateSongMetadataAction } from "../../actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function SongEditPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: song }, { data: categories }, { data: selectedCategories }, { data: sources }] = await Promise.all([
    supabase.from("songs").select("id,title,default_key,bpm,structure,notes").eq("id", id).single(),
    supabase.from("categories").select("id,name,slug").order("name"),
    supabase.from("song_categories").select("category_id").eq("song_id", id),
    supabase.from("song_sources").select("song_number,source_title,song_collections(name,short_code)").eq("song_id", id)
  ]);

  if (!song) notFound();

  const selected = new Set((selectedCategories || []).map((item: any) => item.category_id));

  return (
    <>
      <div className="top-row">
        <div>
          <div className="eyebrow">Editare cântare</div>
          <h1>{song.title}</h1>
          <div className="badges" style={{ marginTop: 12 }}>
            {(sources || []).map((source: any, index: number) => (
              <span className="badge" key={index}>
                {source.song_collections?.short_code || source.song_collections?.name || "Sursă"}{source.song_number ? ` nr. ${source.song_number}` : ""}
              </span>
            ))}
          </div>
        </div>
        <Link className="btn secondary" href={`/songs/${song.id}`}>Înapoi la cântare</Link>
      </div>

      <form action={updateSongMetadataAction} className="grid grid-2 song-edit-layout">
        <input type="hidden" name="song_id" value={song.id} />

        <section className="card form-grid">
          <h2>Specificații cântare</h2>
          <label className="label">Titlu
            <input className="input" name="title" defaultValue={song.title} required />
          </label>
          <div className="form-two">
            <label className="label">Tonalitate
              <input className="input" name="default_key" defaultValue={song.default_key || ""} placeholder="ex: G / A / Em" />
            </label>
            <label className="label">BPM
              <input className="input" name="bpm" type="number" min="30" max="260" defaultValue={song.bpm || ""} placeholder="ex: 72" />
            </label>
          </div>
          <label className="label">Structură
            <input className="input" name="structure" defaultValue={song.structure || ""} placeholder="ex: V1, R, V2, R, Bridge, R" />
          </label>
          <label className="label">Note interne
            <textarea className="textarea" name="notes" defaultValue={song.notes || ""} placeholder="Observații pentru echipă, intrare, tranziție, mod de cântare" />
          </label>
          <button className="btn" type="submit">Salvează modificările</button>
        </section>

        <section className="card">
          <div className="top-row" style={{ marginBottom: 12 }}>
            <h2>Categorii</h2>
            <Link className="btn secondary btn-compact" href="/categories">Administrează categorii</Link>
          </div>
          <p className="muted small">Poți încadra aceeași cântare în mai multe secțiuni.</p>
          <div className="checkbox-grid">
            {(categories || []).map((category: any) => (
              <label className="check-row" key={category.id}>
                <input type="checkbox" name="category_ids" value={category.id} defaultChecked={selected.has(category.id)} />
                <span>
                  <strong>{category.name}</strong>
                  <small>/{category.slug}</small>
                </span>
              </label>
            ))}
            {(!categories || categories.length === 0) ? <p className="muted">Nu există categorii încă. Creează-le din pagina Categorii.</p> : null}
          </div>
        </section>
      </form>
    </>
  );
}
