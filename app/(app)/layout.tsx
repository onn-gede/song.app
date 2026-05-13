import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email,role,is_active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="page-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">♪</span>
          <span className="brand-text">
            <strong>Cântări</strong>
            <span>Bibliotecă & programe</span>
          </span>
        </Link>

        <nav className="nav">
          <span className="nav-label">Lucru rapid</span>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/songs">Toate cântările</Link>
          <Link href="/meetings">Programe / întâlniri</Link>
          <span className="nav-label">Bibliotecă</span>
          <Link href="/collections">Colecții</Link>
          <Link href="/categories">Categorii</Link>
          <Link href="/import">Import fișiere / text</Link>
          <Link href="/review">Verificare import</Link>
          <Link href="/duplicates">Duplicate cântări</Link>
          <span className="nav-label">Setări</span>
          <Link href="/external-sources">Surse externe</Link>
          <Link href="/admin">Administrare date</Link>
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <span className="avatar">{(profile?.full_name || profile?.email || user.email || "U").slice(0, 1).toUpperCase()}</span>
            <span>
              <strong>{profile?.full_name || profile?.email || user.email}</strong><br />
              <span>{profile?.role || "viewer"}</span>
            </span>
          </div>
          <form action={signOutAction}>
            <button className="btn secondary full-width" type="submit">Ieșire</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
