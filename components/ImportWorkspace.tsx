"use client";
import { useState, type ReactNode } from "react";
const tabs=[{id:"link",title:"Din link",hint:"O cântare de pe internet"},{id:"files",title:"Din fișiere",hint:"PPTX, PDF, TXT sau ZIP"},{id:"text",title:"Din text",hint:"Scrie sau lipește versurile"}];
export function ImportWorkspace({link,files,text}:{link:ReactNode;files:ReactNode;text:ReactNode}) {
  const [active,setActive]=useState("link");
  return <div className="import-workspace"><div className="import-method-tabs" role="tablist" aria-label="Alege metoda de import" onKeyDown={e=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;e.preventDefault();
    const i=tabs.findIndex(t=>t.id===active);const next=e.key==="Home"?0:e.key==="End"?2:(i+(e.key==="ArrowRight"?1:2))%3;
    setActive(tabs[next].id);document.getElementById(`import-tab-${tabs[next].id}`)?.focus();
  }}>{tabs.map(t=><button key={t.id} id={`import-tab-${t.id}`} role="tab" aria-selected={active===t.id} aria-controls={`import-panel-${t.id}`} tabIndex={active===t.id?0:-1} className={`import-method-tab${active===t.id?" active":""}`} onClick={()=>setActive(t.id)}><strong>{t.title}</strong><span>{t.hint}</span></button>)}</div>
    {tabs.map(t=><section key={t.id} role="tabpanel" id={`import-panel-${t.id}`} aria-labelledby={`import-tab-${t.id}`} hidden={active!==t.id} className="card import-method-panel">{({link,files,text} as Record<string,ReactNode>)[t.id]}</section>)}
  </div>;
}
