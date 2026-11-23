"use client";

import {useEffect,useLayoutEffect,useRef,useState,type ChangeEvent} from "react";
import {defaultSectionLabel,sectionTypeOptions,splitSectionText,type StructuredSongSection} from "@/lib/section-editor";

type EditorItem=StructuredSongSection&{editorId:string;groupId:string;autoLabel:boolean};
const makeId=()=>typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():`${Date.now()}-${Math.random()}`;

function relabel(items:EditorItem[]){
 let verse=0;const groups=new Map<string,number>();
 return items.map((item,index)=>{
   let ordinal=0;if(item.section_type==="verse"){if(!groups.has(item.groupId))groups.set(item.groupId,++verse);ordinal=groups.get(item.groupId)!;}
   return {...item,position:index+1,section_label:item.autoLabel?defaultSectionLabel(item.section_type,ordinal):item.section_label};
 });
}

export function ImportSectionEditor({initial,onChange,disabled=false}:{initial:StructuredSongSection[];onChange:(sections:StructuredSongSection[])=>void;disabled?:boolean}){
 const [items,setItems]=useState<EditorItem[]>(()=>relabel(initial.map(section=>{const id=makeId();return {...section,editorId:id,groupId:id,autoLabel:true};})));
 const dragged=useRef<number|null>(null);
 function commit(next:EditorItem[]){const ready=relabel(next);setItems(ready);onChange(ready.map(({editorId:_,groupId:__,autoLabel:___,...section})=>section));}
 useEffect(()=>{onChange(items.map(({editorId:_,groupId:__,autoLabel:___,...section})=>section));},[]);// eslint-disable-line react-hooks/exhaustive-deps
 function move(from:number,to:number){if(to<0||to>=items.length||from===to)return;const next=[...items];const [item]=next.splice(from,1);next.splice(to,0,item);commit(next);}
 function changeContent(index:number,value:string){
   const chunks=splitSectionText(value);
   if(chunks.length>1){
     const current=items[index];
     const replacements=chunks.map((content,part)=>({...current,editorId:part?makeId():current.editorId,content}));
     commit([...items.slice(0,index),...replacements,...items.slice(index+1)]);return;
   }
   const next=[...items];next[index]={...next[index],content:value};commit(next);
 }
 function add(after=items.length-1,type="verse"){
   const id=makeId();const next=[...items];next.splice(after+1,0,{editorId:id,groupId:id,section_type:type,section_label:defaultSectionLabel(type),position:after+2,content:"",autoLabel:true});commit(next);
 }
 return <section className="import-section-editor" aria-label="Structura versurilor">
   <div className="section-header-row"><div><h3>Versuri pe secțiuni</h3><p className="muted small">Un rând liber separă automat un calup nou. Poți schimba tipul, eticheta și ordinea.</p></div><button className="btn secondary btn-compact" type="button" disabled={disabled} onClick={()=>add()}>+ Adaugă secțiune</button></div>
   <div className="import-section-list">{items.map((item,index)=><article className="import-section-card" key={item.editorId} onDragOver={event=>event.preventDefault()} onDrop={()=>{if(dragged.current!==null)move(dragged.current,index);dragged.current=null;}}>
     <button className="import-section-drag" type="button" draggable={!disabled} disabled={disabled} onDragStart={()=>{dragged.current=index;}} onDragEnd={()=>{dragged.current=null;}} title="Trage pentru reordonare" aria-label={`Mută ${item.section_label}`}>⋮⋮</button>
     <span className="import-section-position">{index+1}</span>
     <div className="import-section-fields">
       <div className="form-two"><label className="label">Tip<select className="select" value={item.section_type} disabled={disabled} onChange={event=>{const next=[...items];next[index]={...item,section_type:event.target.value,groupId:makeId(),autoLabel:true};commit(next);}}>{sectionTypeOptions.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label className="label">Etichetă<input className="input" value={item.section_label} disabled={disabled} maxLength={100} onChange={event=>{const next=[...items];next[index]={...item,section_label:event.target.value,autoLabel:false};commit(next);}}/></label></div>
       <label className="label">Text<AutoGrowingTextarea value={item.content} disabled={disabled} onChange={event=>changeContent(index,event.target.value)}/></label>
     </div>
     <div className="import-section-actions"><button type="button" className="icon-btn" disabled={disabled||index===0} onClick={()=>move(index,index-1)} aria-label="Mută mai sus">↑</button><button type="button" className="icon-btn" disabled={disabled||index===items.length-1} onClick={()=>move(index,index+1)} aria-label="Mută mai jos">↓</button><button type="button" className="icon-btn" disabled={disabled} onClick={()=>add(index,item.section_type)} aria-label="Adaugă după">+</button><button type="button" className="icon-btn danger" disabled={disabled||items.length===1} onClick={()=>commit(items.filter((_,itemIndex)=>itemIndex!==index))} aria-label="Șterge secțiunea">×</button></div>
   </article>)}</div>
 </section>;
}

function AutoGrowingTextarea({value,disabled,onChange}:{value:string;disabled:boolean;onChange:(event:ChangeEvent<HTMLTextAreaElement>)=>void}){
 const ref=useRef<HTMLTextAreaElement>(null),initialized=useRef(false);
 useLayoutEffect(()=>{const element=ref.current;if(!element)return;if(!initialized.current){element.style.height="auto";element.style.height=`${Math.max(104,element.scrollHeight+2)}px`;initialized.current=true;return;}if(element.scrollHeight>element.clientHeight+2)element.style.height=`${element.scrollHeight+2}px`;},[value]);
 return <textarea ref={ref} className="textarea import-section-text" value={value} disabled={disabled} maxLength={100000} spellCheck={false} onChange={onChange}/>;
}
