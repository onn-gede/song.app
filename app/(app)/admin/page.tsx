import { createClient } from "@/lib/supabase/server";
import { deleteAllAppDataAction, deleteProgramsOnlyAction } from "./actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

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
      <div className="top-row">
        <div>
          <div className="eyebrow">Administrare</div>
          <h1>Control date</h1>
          <p className="muted">Ștergere individuală sau resetare completă a conținutului. Userii și loginurile rămân în Supabase Auth.</p>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="stat"><strong>{songs.count || 0}</strong><span>Cântări</span></div>
        <div className="stat"><strong>{meetings.count || 0}</strong><span>Programe</span></div>
        <div className="stat"><strong>{collections.count || 0}</strong><span>Colecții</span></div>
        <div className="stat"><strong>{categories.count || 0}</strong><span>Categorii</span></div>
      </div>

      <div className="grid grid-2 admin-layout" style={{ marginTop: 16 }}>
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
      </div>
    </>
  );
}
