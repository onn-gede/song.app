"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
export function PublicProgramLive({ slug, version }: { slug: string; version: string }) {
  const router = useRouter(), latest = useRef(version);
  const [message, setMessage] = useState("");
  const [permission, setPermission] = useState<string>("unsupported");
  useEffect(() => { latest.current=version; }, [version]);
  useEffect(() => { if ("Notification" in window) setPermission(Notification.permission); }, []);
  useEffect(() => {
    let stopped=false, busy=false;const controller=new AbortController();
    async function check() {
      if(stopped || busy || document.hidden)return;
      busy=true;
      try {
        const response=await fetch(`/api/public-program/${encodeURIComponent(slug)}`, {cache:"no-store",signal:controller.signal});
        if(stopped)return;
        if(response.status===404){stopped=true;router.refresh();return;}
        if(!response.ok)return;
        const data=await response.json();
        if(typeof data.version!=="string"||data.version===latest.current)return;
        latest.current=data.version;
        setMessage("Programul a fost modificat. Pagina se actualizează automat.");
        if("Notification" in window && Notification.permission==="granted") {
          try {const note=new Notification("SongApp BCBgiroc", {body:"Programul a fost modificat și actualizat.",tag:`songapp-${slug}`});note.onclick=()=>{window.focus();note.close();};}catch{}
        }
        router.refresh();
      } catch { /* Network interruptions retry at the next visible check. */ }
      finally { busy=false; }
    }
    const interval=window.setInterval(check,15000);
    document.addEventListener("visibilitychange",check);
    return()=>{stopped=true;controller.abort();window.clearInterval(interval);document.removeEventListener("visibilitychange",check);};
  }, [slug,router]);
  return <div className="public-live print-hide">
    <span className="live-indicator" title="Actualizare automată când programul se schimbă">● Live</span>
    {permission==="default" ? <button type="button" className="quiet-button" title="Activează notificările browserului" onClick={async()=>{try{setPermission(await Notification.requestPermission());}catch{}}}>🔔 Activează notificările</button> : permission==="granted" ? <span title="Notificări browser activate">🔔</span> : null}
    {message ? <div className="public-live-notice" role="status" aria-live="polite">{message}<button type="button" aria-label="Închide notificarea" onClick={()=>setMessage("")}>×</button></div> : null}
  </div>;
}
