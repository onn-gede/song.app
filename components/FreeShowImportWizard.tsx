"use client";

import { useRef, useState } from "react";
import { importFreeShowAction } from "@/app/(app)/import/actions";
import { parseFreeShow, type FreeShowImport } from "@/lib/freeshow";

type Collection = { id: string; name: string; short_code?: string | null };

export function FreeShowImportWizard({ collections }: { collections: Collection[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<FreeShowImport | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  async function choose(file?: File) {
    setError(""); setPreview(null); setRaw("");
    if (!file) return;
    if (!/\.(show|json)$/i.test(file.name)) { setError("Alege un fișier FreeShow .show sau .json."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Fișierul FreeShow depășește limita de 5 MB."); return; }
    try {
      const text = await file.text();
      const parsed = parseFreeShow(text);
      setRaw(text); setFileName(file.name); setPreview(parsed); setTitle(parsed.title);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Fișierul FreeShow nu poate fi citit."); }
  }

  return <details className="import-format-help freeshow-import" open>
    <summary>Importă din FreeShow (.show / .json)</summary>
    <div className="form-grid freeshow-import-body">
      <p className="muted">Selectează show-ul, verifică titlul și secțiunile, apoi confirmă salvarea în SongApp.</p>
      <input ref={input} className="input" type="file" accept=".show,.json,application/json" onChange={(event)=>void choose(event.target.files?.[0])}/>
      {error?<p className="error" role="alert">{error}</p>:null}
      {preview?<form action={importFreeShowAction} className="form-grid">
        <input type="hidden" name="freeshow_json" value={raw}/><input type="hidden" name="file_name" value={fileName}/>
        <input type="hidden" name="structure" value={preview.structure||""}/><input type="hidden" name="default_key" value={preview.defaultKey||""}/>
        <div className="freeshow-preview-heading"><div><span className="eyebrow">Preview FreeShow</span><h3>{preview.sections.length} secțiuni identificate</h3></div><span className="badge">{fileName}</span></div>
        <label className="label">Titlu în SongApp<input className="input" name="title" required value={title} maxLength={240} onChange={(event)=>setTitle(event.target.value)}/></label>
        <div className="form-two">
          <label className="label">Colecție existentă<select className="select" name="collection_id" defaultValue=""><option value="">Fără selecție / colecția manuală</option>{collections.map((collection)=><option key={collection.id} value={collection.id}>{collection.name}{collection.short_code?` (${collection.short_code})`:""}</option>)}</select></label>
          <label className="label">Număr în colecție<input className="input" name="song_number" defaultValue={preview.songNumber||""} placeholder="Automat sau completează manual"/></label>
        </div>
        <details className="freeshow-section-preview"><summary>Vezi textele care vor fi importate</summary><div className="freeshow-section-list">{preview.sections.map((section,index)=><article key={`${section.label}-${index}`}><strong>{section.label}</strong><pre>{section.content}</pre></article>)}</div></details>
        <div className="inline-form"><button className="btn" type="submit">Importă în SongApp</button><button className="btn secondary" type="button" onClick={()=>{setPreview(null);setRaw("");setFileName("");if(input.current)input.current.value="";}}>Alege alt fișier</button></div>
      </form>:null}
    </div>
  </details>;
}
