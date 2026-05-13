import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ImportFilesWizard } from "@/components/ImportFilesWizard";
import { importTextSongAction } from "./actions";

const sourceTypes = [
  ["txt", "Text simplu"],
  ["manual", "Manual"],
  ["pptx", "PPTX transcris"],
  ["ppt", "PPT transcris"],
  ["pdf", "PDF transcris"],
  ["docx", "DOCX transcris"],
  ["other", "Alt format"]
];

function CollectionFields({ collections, idPrefix = "" }: { collections: any[] | null; idPrefix?: string }) {
  return (
    <div className="form-two">
      <label className="label">Colecție existentă
        <select className="select" name="collection_id" defaultValue="">
          <option value="">Alege colecția...</option>
          {(collections || []).map((collection: any) => (
            <option key={`${idPrefix}${collection.id}`} value={collection.id}>{collection.name} ({collection.short_code})</option>
          ))}
        </select>
      </label>
      <label className="label">Sau colecție nouă
        <input className="input" name="new_collection_name" placeholder="ex: Colinde 2026" />
      </label>
    </div>
  );
}

function SongMetadataFields() {
  return (
    <div className="form-three">
      <label className="label">Tonalitate
        <input className="input" name="default_key" placeholder="ex: D, G, Em" />
      </label>
      <label className="label">BPM
        <input className="input" type="number" name="bpm" min="30" max="260" placeholder="ex: 72" />
      </label>
      <label className="label">Structură
        <input className="input" name="structure" placeholder="ex: V1, R, V2, R" />
      </label>
    </div>
  );
}

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: collections } = await supabase
    .from("song_collections")
    .select("id,name,short_code,source_type")
    .eq("is_active", true)
    .order("name");

  return (
    <>
      <div className="top-row">
        <div>
          <div className="eyebrow">Import</div>
          <h1>Importă cântări</h1>
          <p className="muted">Adaugă cântări din TXT, PPTX, PDF sau ZIP. Pentru importul unic local, .ppt vechi merge doar dacă ENABLE_LEGACY_PPT_IMPORT este activ și LibreOffice este instalat.</p>
        </div>
        <div className="inline-form">
          <Link className="btn secondary" href="/collections">Colecții</Link>
          <Link className="btn" href="/review">Verificare import</Link>
        </div>
      </div>

      <div className="grid import-layout">
        <section className="card import-primary-card">
          <div className="section-editor-header">
            <div>
              <h2>Import din fișiere</h2>
              <p className="muted small">Poți încărca un fișier sau mai multe. Pentru multe PPT/PPTX odată, poți încărca și o arhivă ZIP.</p>
            </div>
            <span className="badge">TXT · PPTX · PDF · ZIP · PPT local</span>
          </div>

          <ImportFilesWizard collections={collections || []} />
        </section>

        <aside className="card-soft import-help-card">
          <h2>Recomandare pentru PPT</h2>
          <div className="tip-list">
            <p><strong>1.</strong> Pentru cântările din PowerPoint folosește <strong>.pptx</strong>. Pentru importul tău unic local, fișierele vechi <strong>.ppt</strong> se convertesc automat doar dacă ai <strong>ENABLE_LEGACY_PPT_IMPORT=true</strong> și LibreOffice instalat.</p>
            <p><strong>2.</strong> Numele fișierului poate fi de tipul <strong>352 - Titlu cântare.ppt / .pptx</strong>; aplicația preia automat numărul și titlul.</p>
            <p><strong>3.</strong> Pentru import masiv, pune mai multe PPTX/TXT/PDF într-un ZIP. PPT vechi în ZIP merge doar în modul local temporar cu LibreOffice activ.</p>
            <p><strong>4.</strong> PDF-urile trebuie să aibă text selectabil. Pentru scanări va fi nevoie de OCR separat.</p>
          </div>
        </aside>
      </div>

      <div className="grid import-layout" style={{ marginTop: 16 }}>
        <section className="card">
          <h2>Import manual din text</h2>
          <form action={importTextSongAction} className="form-grid">
            <label className="label">Titlu cântare
              <input className="input" name="title" placeholder="ex: Când furtuni în viață-mi vin" required />
            </label>

            <CollectionFields collections={collections || []} idPrefix="manual-" />

            <div className="form-two">
              <label className="label">Număr în colecție
                <input className="input" name="song_number" placeholder="ex: 352 sau 001b" />
              </label>
              <label className="label">Tip sursă
                <select className="select" name="source_type" defaultValue="txt">
                  {sourceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>

            <SongMetadataFields />

            <label className="label">Versuri
              <textarea className="textarea import-lyrics" name="lyrics_text" required placeholder={"Strofa 1\n...\n\nRefren\n...\n\nStrofa 2\n..."} />
            </label>

            <label className="label">Note interne
              <textarea className="textarea" name="notes" placeholder="Observații despre cântare, sursă, adaptări, variante etc." />
            </label>

            <button className="btn secondary" type="submit">Importă textul și verifică versurile</button>
          </form>
        </section>

        <aside className="card-soft">
          <h2>Cum pregătești textul</h2>
          <div className="tip-list">
            <p><strong>1.</strong> Pune o linie goală între strofe/refren. Aplicația va crea automat secțiuni separate.</p>
            <p><strong>2.</strong> Dacă scrii „Refren” la începutul unui bloc, secțiunea va fi marcată ca refren.</p>
            <p><strong>3.</strong> După import ajungi direct în editorul de versuri, unde poți corecta ordinea și etichetele.</p>
            <p><strong>4.</strong> Importul intră cu status „de verificat”, ca să nu amestecăm cântările curate cu cele neverificate.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
