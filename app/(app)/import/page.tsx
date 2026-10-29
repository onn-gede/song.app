import {PresentationImportWizard} from "@/components/PresentationImportWizard";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { ImportLinkWizard } from "@/components/ImportLinkWizard";
import { ImportWorkspace } from "@/components/ImportWorkspace";
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
  const { supabase } = await requireProfile("editor");
  const { data: collections, error } = await supabase
    .from("song_collections")
    .select("id,name,short_code,source_type")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error("Colecțiile nu pot fi încărcate momentan.");

  return (
    <>
      <div className="top-row page-heading-v44">
        <div>
          <div className="eyebrow">Extinde repertoriul echipei</div>
          <h1>Importă cântări</h1>
          <p className="muted">Alege sursa cântării, verifică versurile și adaug-o în colecțiile tale.</p>
        </div>
        <div className="inline-form">
          <Link className="btn secondary" href="/collections">Colecții</Link>
          <Link className="btn" href="/review">Verificare import</Link>
        </div>
      </div>

      <ImportWorkspace
        link={<ImportLinkWizard collections={collections || []}/>}
        files={<><h2>Importă din fișiere</h2>{process.env.NEXT_PUBLIC_IMPORT_LIMIT_MB ? <p className="muted small">Maximum {process.env.NEXT_PUBLIC_IMPORT_LIMIT_MB} MB în total per lot în varianta online.</p> : null}<p className="muted">Încarcă unul sau mai multe fișiere, verifică preview-ul și confirmă importul.</p><PresentationImportWizard collections={collections||[]}/><details className="import-format-help"><summary>Import cu extragerea versurilor (PPTX, PDF, TXT)</summary><ImportFilesWizard collections={collections || []}/></details><details className="import-format-help"><summary>Formate acceptate și recomandări</summary><p>PPTX, TXT și PDF cu text selectabil. Poți grupa mai multe fișiere într-un ZIP. Pentru fișierele vechi PPT, salvează mai întâi ca PPTX din PowerPoint.</p></details></>}
        text={<><h2>Adaugă din text</h2><p className="muted">Lipește versurile, cu o linie goală între strofe. După salvare poți verifica secțiunile în editor.</p>          <form action={importTextSongAction} className="form-grid">
            <label className="label">Titlu cântare
              <input className="input" name="title" placeholder="ex: Când furtuni în viață-mi vin" required />
            </label>

            <label className="label">Versuri
              <textarea className="textarea import-lyrics" name="lyrics_text" required placeholder={"Strofa 1\n...\n\nRefren\n...\n\nStrofa 2\n..."} />
            </label>

            <details className="import-optional-fields"><summary>Detalii opționale și colecție</summary><div className="form-grid">
            <CollectionFields collections={collections || []} idPrefix="manual-" />

            <div className="form-two">
              <label className="label">Număr în colecție
                <input className="input" name="song_number" placeholder="Automat: următorul număr disponibil" />
              </label>
              <label className="label">Tip sursă
                <select className="select" name="source_type" defaultValue="txt">
                  {sourceTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>

            <SongMetadataFields />

            <label className="label">Note interne
              <textarea className="textarea" name="notes" placeholder="Observații despre cântare, sursă, adaptări, variante etc." />
            </label>

            </div></details>
            <button className="btn secondary" type="submit">Importă textul și verifică versurile</button>
          </form></>}
      />
    </>
  );
}
