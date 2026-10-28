"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { previewSongLinkAction, saveSongLinkAction, type LinkImportPreview } from "@/app/(app)/import/link-actions";

type Collection = { id:string;name:string;short_code?:string | null };
export function ImportLinkWizard({collections}:{collections:Collection[]}) {
  const [url,setUrl]=useState("");
  const [preview,setPreview]=useState<LinkImportPreview | null>(null);
  const [title,setTitle]=useState("");const [lyrics,setLyrics]=useState("");
  const [selected,setSelected]=useState<string[]>([]);const [existing,setExisting]=useState("");
  const [structure,setStructure]=useState("");const [notes,setNotes]=useState("");const [number,setNumber]=useState("");
  const [error,setError]=useState("");const [busy,start]=useTransition();
  const [saved,setSaved]=useState<{songId:string;created:boolean} | null>(null);
  const flight=useRef(false);const previewHeading=useRef<HTMLHeadingElement>(null);
  function readLink(event:React.FormEvent) {
    event.preventDefault();if(flight.current)return;flight.current=true;setError("");setPreview(null);setSaved(null);
    start(async()=>{
      try {
        const result=await previewSongLinkAction(url);setPreview(result);setTitle(result.title);setLyrics(result.lyricsText);
        setExisting(result.matches.find(m=>m.sourceMatch)?.songId || "");setStructure(result.structure);setNumber("");
        setNotes([result.author && `Autor: ${result.author}`,result.album && `Album: ${result.album}`,result.topic && `Tematică: ${result.topic}`,`Sursa: ${result.url}`].filter(Boolean).join("\n"));
        window.setTimeout(()=>previewHeading.current?.focus(),0);
      } catch(e){setError(e instanceof Error?e.message:"Nu am putut citi linkul.");}
      finally{flight.current=false;}
    });
  }
  function save(event:React.FormEvent) {
    event.preventDefault();if(!preview||flight.current)return;flight.current=true;setError("");
    start(async()=>{
      try {setSaved(await saveSongLinkAction({url:preview.url,title,lyricsText:lyrics,collectionIds:selected,existingSongId:existing || null,notes,structure,songNumber:number}));}
      catch(e){setError(e instanceof Error?e.message:"Salvarea a eșuat. Preview-ul este păstrat.");}
      finally{flight.current=false;}
    });
  }
  return <div className="link-import-wizard">
    <ol className="import-steps" aria-label="Pașii importului"><li>1. Adaugă linkul</li><li>2. Verifică textul</li><li>3. Alege colecțiile și salvează</li></ol>
    <form onSubmit={readLink} className="link-reader-form">
      <label className="label" htmlFor="song-link">Linkul cântării<input id="song-link" className="input" type="url" value={url} onChange={e=>setUrl(e.target.value)} required placeholder="https://melodia.ro/cantari/... sau alt site" disabled={busy}/></label>
      <button className="btn" disabled={busy || !url.trim()}>{busy && !preview?"Se citește pagina…":"Citește linkul"}</button>
    </form>
    <p className="muted small">Linkuri publice Melodia, Resurse Creștine și alte site-uri cu versuri identificabile. Verifică întotdeauna preview-ul.</p>
    {error?<p className="error" role="alert">{error}</p>:null}
    {saved?<section className="import-success" role="status"><h2>{saved.created?"Cântarea a fost adăugată":"Cântarea existentă a fost asociată colecțiilor"}</h2><p>Poți deschide cântarea sau importa următorul link.</p><div className="inline-form"><Link className="btn" href={`/songs/${saved.songId}`}>Deschide cântarea</Link><button className="btn secondary" onClick={()=>{setSaved(null);setPreview(null);setUrl("");document.getElementById("song-link")?.focus();}}>Importă alt link</button></div></section>:preview?<form onSubmit={save} className="link-preview-layout">
      <section className="link-preview-editor">
        <div className="section-header-row"><h2 tabIndex={-1} ref={previewHeading}>Verifică înainte de salvare</h2><span className="badge">Preview</span></div>
        <label className="label">Titlu<input className="input" value={title} onChange={e=>setTitle(e.target.value)} required maxLength={300} disabled={busy || !!existing}/></label>
        <div className="source-metadata">{preview.author?<span>Autor: <strong>{preview.author}</strong></span>:null}{preview.topic?<span>Tematică: {preview.topic}</span>:null}<a href={preview.url} target="_blank" rel="noreferrer">Deschide pagina sursă ↗</a></div>
        <label className="label">Versuri · poți corecta textul și etichetele strofelor<textarea className="textarea link-lyrics-editor" value={lyrics} onChange={e=>setLyrics(e.target.value)} required maxLength={100000} disabled={busy || !!existing} spellCheck={false}/></label>
        <p className="muted small">O linie goală separă secțiunile. Sunt recunoscute etichetele Strofa 1, Refren și Bridge.</p>
      </section>
      <aside className="link-preview-settings">
        {preview.matches.length?<section className="import-match-notice"><h3>Există cântări asemănătoare</h3><p className="small">Poți folosi cântarea existentă, păstrând versurile ei, sau crea una nouă. Același link deja importat va reutiliza cântarea existentă.</p><label className="label">Cum vrei să continui?<select className="select" value={existing} onChange={e=>setExisting(e.target.value)} disabled={busy || preview.matches.some(m=>m.sourceMatch)}><option value="">Creează o cântare nouă</option>{preview.matches.map(m=><option key={m.songId} value={m.songId}>{m.title}{m.sourceMatch?" · același link":""}</option>)}</select></label>{existing?<Link href={`/songs/${existing}`} target="_blank">Verifică cântarea existentă ↗</Link>:null}</section>:null}
        <fieldset className="import-collection-picker" disabled={busy}><legend>Adaugă în colecțiile existente</legend><p className="muted small">Selectează cel puțin una. Poți bifa mai multe colecții.</p><div className="import-collection-options">{collections.map(c=><label className={`import-collection-option${selected.includes(c.id)?" selected":""}`} key={c.id}><input type="checkbox" checked={selected.includes(c.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,c.id]:ids.filter(id=>id!==c.id))}/><span>{c.name}{c.short_code?<small>{c.short_code}</small>:null}</span></label>)}</div>{!collections.length?<p>Nu ai colecții active. <Link href="/collections">Creează o colecție</Link>, apoi reîncarcă pagina.</p>:null}</fieldset>
        <details className="import-optional-fields"><summary>Detalii opționale</summary><div className="form-grid"><label className="label">Număr în colecții<input className="input" value={number} onChange={e=>setNumber(e.target.value)} placeholder="Automat dacă lași gol" maxLength={60} disabled={busy}/></label><label className="label">Ordinea interpretării<input className="input" value={structure} onChange={e=>setStructure(e.target.value)} maxLength={500} disabled={busy || !!existing}/></label><label className="label">Note și sursă<textarea className="textarea" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={5000} disabled={busy || !!existing}/></label></div></details>
        <p className="muted small">{selected.length} {selected.length===1?"colecție selectată":"colecții selectate"}. {existing?"Versurile existente rămân nemodificate.":"Cântarea va putea fi editată și după salvare."}</p>
        <button className="btn full-width" disabled={busy || !selected.length || !title.trim() || lyrics.trim().length<20}>{busy?"Se salvează…":existing?"Adaugă cântarea în colecții":"Salvează cântarea în colecții"}</button>
      </aside>
    </form>:null}
  </div>;
}
