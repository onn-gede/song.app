import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/login/actions";

const navGroups = [
  {
    label: "Principal",
    items: [
      { href: "/dashboard", icon: "⌘", title: "Dashboard", hint: "Căutare și sumar" },
      { href: "/songs", icon: "♫", title: "Cântări", hint: "Biblioteca completă" },
      { href: "/meetings", icon: "▦", title: "Programe", hint: "Întâlniri și playlisturi" }
    ]
  },
  {
    label: "Bibliotecă",
    items: [
      { href: "/collections", icon: "▣", title: "Colecții", hint: "Surse și cărți" },
      { href: "/categories", icon: "#", title: "Categorii", hint: "Tematici" },
      { href: "/import", icon: "⇧", title: "Import", hint: "PPTX, TXT, PDF" },
      { href: "/review", icon: "✓", title: "Verificare", hint: "Importuri noi" },
      { href: "/duplicates", icon: "≋", title: "Duplicate", hint: "Unificare" }
    ]
  },
  {
    label: "Setări",
    items: [
      { href: "/external-sources", icon: "↻", title: "Surse externe", hint: "Sincronizări" },
      { href: "/admin", icon: "⚙", title: "Administrare", hint: "Date aplicație" }
    ]
  }
];

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

  const displayName = profile?.full_name || profile?.email || user.email || "Utilizator";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "U";

  return (
    <div className="page-shell app-shell-v39">
      <aside className="sidebar sidebar-v39">
        <Link href="/dashboard" className="brand brand-v39" aria-label="Dashboard biblioteca de cântări">
          <span className="brand-mark brand-mark-v39">♪</span>
          <span className="brand-text brand-text-v39">
            <strong>Cântări</strong>
            <span>Library & Planning</span>
          </span>
        </Link>

        <nav className="nav nav-v39" aria-label="Meniu principal">
          {navGroups.map((group) => (
            <div className="nav-group-v39" key={group.label}>
              <span className="nav-label nav-label-v39">{group.label}</span>
              <div className="nav-group-items-v39">
                {group.items.map((item) => (
                  <Link className="nav-link-v39" href={item.href} key={item.href}>
                    <span className="nav-icon-v39" aria-hidden="true">{item.icon}</span>
                    <span className="nav-link-copy-v39">
                      <span>{item.title}</span>
                      <small>{item.hint}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer sidebar-footer-v39">
          <div className="user-pill user-pill-v39">
            <span className="avatar avatar-v39">{initials}</span>
            <span className="user-copy-v39">
              <strong>{displayName}</strong>
              <span>{profile?.role || "viewer"}</span>
            </span>
          </div>
          <form action={signOutAction}>
            <button className="btn secondary full-width btn-sidebar-v39" type="submit">Ieșire</button>
          </form>
        </div>
      </aside>
      <main className="main main-v39">{children}</main>
    </div>
  );
}
