"use client";
import { useEffect,useRef,useState,useTransition } from "react";
import { useRouter,useSearchParams } from "next/navigation";
import { Icon } from "./Icon";
type Option={id:string;name:string;short_code?:string|null};
type Values={q:string;collection:string;category:string;key:string;number:string;status:string;sort:string};
export function LibraryToolbar({collections,categories,keys}:{collections:Option[];categories:Option[];keys:string[]}) {
 const params=useSearchParams(),router=useRouter();const signature=params.toString();
 const initial=()=>Object.fromEntries(["q","collection","category","key","number","status","sort"].map(k=>[k,params.get(k)|| (k==="sort"?"title_asc":"")])) as Values;
 const [values,setValues]=useState<Values>(initial);const [advanced,setAdvanced]=useState(!!(params.get("number")||params.get("status")));
 const [pending,start]=useTransition();const first=useRef(true);const submittedQuery=useRef(params.get("q")||"");const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{submittedQuery.current=params.get("q")||"";setValues(initial());},[signature]);
 const navigate=(next:Values)=>{submittedQuery.current=next.q;const p=new URLSearchParams();for(const [k,v]of Object.entries(next))if(v.trim()&&!(k==="sort"&&v==="title_asc"))p.set(k,v.trim());p.set("page","1");start(()=>router.replace(`/songs?${p}`,{scroll:false}));};
 useEffect(()=>{
  if(first.current){first.current=false;return;}
  if(values.q===submittedQuery.current)return;
  const timer=setTimeout(()=>navigate(values),450);return()=>clearTimeout(timer);
 },[values.q]);
 const change=(key:keyof Values,value:string,apply=true)=>{const next={...values,[key]:value};setValues(next);if(apply)navigate(next);};
 const clear=()=>{const next={q:"",collection:"",category:"",key:"",number:"",status:"",sort:"title_asc"};setValues(next);try{localStorage.removeItem("songapp:songs-filters:v1");}catch{}navigate(next);};
 useEffect(()=>{const handle=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;const editing=target.closest('input,textarea,select,[contenteditable="true"]');if(e.key==="/"&&!editing&&!e.ctrlKey&&!e.metaKey){e.preventDefault();input.current?.focus();}};window.addEventListener("keydown",handle);return()=>window.removeEventListener("keydown",handle);},[]);
 const chips=[
  {key:"q",value:params.get("q"),label:`Căutare: ${params.get("q")}`},
  {key:"collection",value:params.get("collection"),label:collections.find(c=>c.id===params.get("collection"))?.name||"Colecție"},
  {key:"category",value:params.get("category"),label:categories.find(c=>c.id===params.get("category"))?.name||"Categorie"},
  {key:"key",value:params.get("key"),label:`Tonalitate ${params.get("key")}`},
  {key:"number",value:params.get("number"),label:`Nr. ${params.get("number")}`},
  {key:"status",value:params.get("status"),label:({needs_review:"De verificat",approved:"Verificate",failed:"Import eșuat"} as Record<string,string>)[params.get("status")||""]||"Status import"}
 ].filter(chip=>chip.value);
 return <form className="library-toolbar-v44" role="search" aria-label="Caută și filtrează cântările" onSubmit={e=>{e.preventDefault();navigate(values);}}>
  <div className="library-search-v44"><Icon name="search" size={22}/><input ref={input} maxLength={300} value={values.q} onChange={e=>change("q",e.target.value,false)} placeholder="Caută după titlu, versuri sau număr…" aria-label="Caută în bibliotecă"/>{values.q?<button type="button" aria-label="Șterge căutarea" onClick={()=>change("q","")}><Icon name="close" size={18}/></button>:<kbd>/</kbd>}</div>
  <div className="library-filter-line">
   <label><Icon name="folder" size={17}/><select aria-label="Colecție" value={values.collection} onChange={e=>change("collection",e.target.value)}><option value="">Toate colecțiile</option>{collections.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
   <label><Icon name="tag" size={17}/><select aria-label="Categorie" value={values.category} onChange={e=>change("category",e.target.value)}><option value="">Toate categoriile</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
   <label><Icon name="music" size={17}/><select aria-label="Tonalitate" value={values.key} onChange={e=>change("key",e.target.value)}><option value="">Orice tonalitate</option>{keys.map(k=><option key={k}>{k}</option>)}</select></label>
   <button className={`library-more-filters${advanced?" is-open":""}`} type="button" onClick={()=>setAdvanced(!advanced)} aria-expanded={advanced} aria-controls="library-advanced-filters"><Icon name="filter" size={17}/>Mai multe filtre{values.number||values.status?<span className="filter-count">{Number(!!values.number)+Number(!!values.status)}</span>:null}</button>
   <button type="button" className="btn secondary" onClick={clear}>Resetează filtrele</button><label className="library-sort"><select aria-label="Sortează cântările" value={values.sort} onChange={e=>change("sort",e.target.value)}><option value="title_asc">Titlu: A → Z</option><option value="title_desc">Titlu: Z → A</option><option value="most_sung">Cele mai des cântate</option><option value="last_sung">Cântate recent în programe</option><option value="created_desc">Adăugate recent</option><option value="source_number_asc">Număr: crescător</option><option value="source_number_desc">Număr: descrescător</option></select></label>
  </div>
  <div id="library-advanced-filters" className="library-advanced-v44" hidden={!advanced}>
   <label className="label">Număr în colecție<input className="input" value={values.number} onChange={e=>change("number",e.target.value,false)} placeholder="ex: 352"/></label>
   <label className="label">Starea importului<select className="select" value={values.status} onChange={e=>change("status",e.target.value,false)}><option value="">Toate stările</option><option value="needs_review">De verificat</option><option value="approved">Verificate</option><option value="failed">Import eșuat</option></select></label>
   <button className="btn secondary" type="submit">Aplică filtrele</button>
  </div>
  {chips.length?<div className="library-active-filters" aria-label="Filtre active">{chips.map(chip=><button type="button" key={chip.key} onClick={()=>change(chip.key as keyof Values,"")} aria-label={`Elimină filtrul ${chip.label}`}>{chip.label}<Icon name="close" size={13}/></button>)}<button type="button" className="clear-all-filters" onClick={clear}>Resetează tot</button></div>:null}
  {pending?<span className="library-update-status" role="status">Se actualizează lista…</span>:null}
 </form>;
}
