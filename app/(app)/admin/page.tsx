import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { deleteAllAppDataAction, deleteProgramsOnlyAction } from "./actions";
import {Icon} from "@/components/Icon";
import { FREESHOW_CONNECTOR_EXE_URL } from "@/lib/freeshow-local";

export default async function AdminPage() {
  const {supabase,profile}=await requireProfile("admin");

  const [songs, meetings, collections, categories, imports] = await Promise.all([
    supabase.from("songs").select("id", { count: "exact", head: true }),
    supabase.from("meetings").select("id", { count: "exact", head: true }),
    supabase.from("song_collections").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("song_files").select("id", { count: "exact", head: true })
  ]);

  const isAdmin = profile?.role === "admin";

  return (
    <>
      <div className="top-row admin-page-heading">
        <div>
          <div className="eyebrow">Administrare</div>
          <h1>Administrare</h1><p>Conturi, siguranța datelor și instrumentele de întreținere ale aplicației.</p>
        </div>
      </div>

      <nav className="admin-tool-grid" aria-label="Instrumente de administrare">
        <Link href="/admin/users" className="admin-tool-card admin-tool-primary"><span className="admin-tool-icon"><Icon name="users"/></span><span><strong>Conturi și aprobări</strong><small>Aprobă utilizatori, schimbă numele și rolurile.</small></span><Icon name="chevron" size={18}/></Link>
        <Link href="/admin/backup" className="admin-tool-card"><span className="admin-tool-icon"><Icon name="copy"/></span><span><strong>Backup și restaurare</strong><small>Export complet și restaurare cu previzualizare.</small></span><Icon name="chevron" size={18}/></Link>
        <Link href="/admin/activity" className="admin-tool-card"><span className="admin-tool-icon"><Icon name="clock"/></span><span><strong>Jurnal de activitate</strong><small>Vezi cine a modificat conținutul aplicației.</small></span><Icon name="chevron" size={18}/></Link>
        <Link href="/admin/lyrics-repair" className="admin-tool-card"><span className="admin-tool-icon"><Icon name="music"/></span><span><strong>Repară versurile · Tineri</strong><small>Corectează primul vers lipsă din colecția Tineri.</small></span><Icon name="chevron" size={18}/></Link>
        <a href={FREESHOW_CONNECTOR_EXE_URL} className="admin-tool-card admin-tool-primary"><span className="admin-tool-icon"><Icon name="upload"/></span><span><strong>Instalator FreeShow · Windows (.exe)</strong><small>Un singur fișier, cu pornire automată, Start, Stop și dezinstalare.</small></span><Icon name="chevron" size={18}/></a>
        <a href="/downloads/SongApp-FreeShow-Connector-Setup-Windows.zip" download className="admin-tool-card"><span className="admin-tool-icon"><Icon name="copy"/></span><span><strong>Conector FreeShow · rezervă ZIP</strong><small>Varianta cu SETUP-CONNECTOR.cmd, pentru instalare manuală.</small></span><Icon name="chevron" size={18}/></a>
        <a href="/downloads/README-Conector-FreeShow.txt" target="_blank" rel="noreferrer" className="admin-tool-card"><span className="admin-tool-icon"><Icon name="copy"/></span><span><strong>Instrucțiuni FreeShow</strong><small>Instalare, diagnostic și toate linkurile oficiale necesare.</small></span><Icon name="chevron" size={18}/></a>
      </nav>

      <div className="grid grid-4 admin-stat-grid">
        <div className="stat"><strong>{songs.count || 0}</strong><span>Cântări</span></div>
        <div className="stat"><strong>{meetings.count || 0}</strong><span>Programe</span></div>
        <div className="stat"><strong>{collections.count || 0}</strong><span>Colecții</span></div>
        <div className="stat"><strong>{categories.count || 0}</strong><span>Categorii</span></div>
      </div>

      <details className="card" style={{marginTop:16}}><summary>Operațiuni avansate asupra datelor</summary><div className="grid grid-2 admin-layout" style={{ marginTop: 16 }}>
        <section className="card danger-card">
          <div className="badge danger-badge">Admin only</div>
          <h2>Șterge toate programele</h2>
          <p className="muted">Șterge întâlnirile, elementele din programe și linkurile publice. Biblioteca de cântări rămâne intactă.</p>
          {!isAdmin ? <p className="error">Doar un admin poate executa această acțiune.</p> : null}
          <form action={deleteProgramsOnlyAction} className="form-grid">
            <label className="label">Confirmare
              <input className="input" name="confirm" placeholder="scrie: STERGE PROGRAME" disabled={!isAdmin} />
            </label>
            <button className="btn danger" type="submit" disabled={!isAdmin}>Șterge programele</button>
          </form>
        </section>

        <section className="card danger-card danger-card-strong">
          <div className="badge danger-badge">Reset complet</div>
          <h2>Șterge tot conținutul aplicației</h2>
          <p className="muted">Șterge cântări, versuri, surse, importuri, categorii, colecții, versete, programe și linkuri publice. Nu șterge profilele/userii.</p>
          <p className="small"><strong>Conținut curent:</strong> {songs.count || 0} cântări · {imports.count || 0} importuri · {meetings.count || 0} programe.</p>
          {!isAdmin ? <p className="error">Doar un admin poate executa această acțiune.</p> : null}
          <form action={deleteAllAppDataAction} className="form-grid">
            <label className="label">Confirmare exactă
              <input className="input" name="confirm" placeholder="scrie: STERGE TOT" disabled={!isAdmin} />
            </label>
            <button className="btn danger" type="submit" disabled={!isAdmin}>Șterge tot conținutul</button>
          </form>
        </section>
      </div></details>
    </>
  );
}
