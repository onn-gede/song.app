import Link from "next/link";
import { requireProfile } from "@/lib/auth";
type Row = { reference_number: string; title: string; musical_key: string | null; original_notation: string; song_id: string | null; match_status: string };
const labels: Record<string, string> = { applied: "Aplicată", matched: "Corespondență găsită", no_key: "Fără gamă în document", review_notation: "Notație de verificat", no_match: "Corespondență negăsită", ambiguous: "Mai multe cântări posibile", conflicting_keys: "Game diferite pentru aceeași piesă", edited_after_import: "Modificată manual după import" };
export default async function YouthKeysPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { supabase,profile } = await requireProfile("read");
  const filter = (await searchParams).filter || "all";
  const { data, error } = await supabase.rpc("get_youth_key_matches_v46");
  const rows = (data || []) as Row[];
  const applied = rows.filter(row => row.match_status === "applied").length;
  const visible = rows.filter(row => filter === "applied" ? row.match_status === "applied" : filter === "review" ? row.match_status !== "applied" : true);
  return <div><div className="page-heading-v44"><div><div className="eyebrow">Colecția Tineri</div><h1>Gamele cântărilor</h1>{profile.role==='admin'?<Link className="btn secondary" href="/admin/lyrics-repair">Repară primul vers</Link>:null}<p>Corespondențele din lista furnizată, verificate după titlu și număr în colecție.</p></div><Link className="btn secondary" href="/collections">Înapoi la colecții</Link></div>
    {error ? <p className="error">Rulează UPDATE-V46.sql în proiectul existent pentru importul gamelor.</p> : <>
      <p>{rows.length} poziții în document · <strong>{applied} aplicate</strong> · {rows.length - applied} de verificat / fără tonalitate.</p>
      <p className="muted small">Literele mici din document au fost interpretate ca game minore (a → Am). Alternativele și modulațiile se păstrează în observații. „D/E” rămâne de verificat. Corespondențele incerte nu schimbă piesele. Programele existente își păstrează tonalitățile selectate.</p>
      <nav className="page-tabs-v44" aria-label="Filtre game"><Link href="?filter=all" aria-current={filter === "all" ? "page" : undefined}>Toate</Link><Link href="?filter=applied" aria-current={filter === "applied" ? "page" : undefined}>Aplicate</Link><Link href="?filter=review" aria-current={filter === "review" ? "page" : undefined}>De verificat</Link></nav>
      <div className="key-reference-table"><table><thead><tr><th>Nr.</th><th>Cântare</th><th>Gamă</th><th>Observații din document</th><th>Rezultat</th></tr></thead><tbody>{visible.map(row => <tr key={row.reference_number}><td>{row.reference_number}</td><td>{row.song_id ? <Link prefetch={false} href={`/songs/${row.song_id}`}>{row.title || "Fără titlu"}</Link> : row.title || "Fără titlu"}</td><td><strong>{row.musical_key || "—"}</strong></td><td>{row.original_notation || "—"}</td><td>{labels[row.match_status] || row.match_status}</td></tr>)}</tbody></table></div>
    </>}
  </div>;
}
