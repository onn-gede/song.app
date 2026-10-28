"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function AuditPrintTracker(){const path=usePathname();useEffect(()=>{
 if(path==='/login')return;
 const log=()=>{const endpoint=path.startsWith('/program/')?`/api/public-program/${encodeURIComponent(path.split('/')[2])}/activity`:'/api/activity';void fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'program.print',path}),keepalive:true}).catch(()=>{});};
 window.addEventListener('beforeprint',log);return()=>window.removeEventListener('beforeprint',log);
},[path]);return null;}
