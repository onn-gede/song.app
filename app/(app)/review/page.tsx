import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReviewBulkStatusList } from "@/components/ReviewBulkStatusList";

type PageProps = {
  searchParams?: Promise<{
    status?: string;
    imported?: string;
    skipped?: string;
  }>;
};

const STATUS_OPTIONS = [
  { value: "needs_review", label: "De verificat" },
  { value: "parsed", label: "Extrase automat" },
  { value: "approved", label: "Verificate" },
  { value: "pending", label: "În așteptare" },
  { value: "failed", label: "Eșuate" },
  { value: "all", label: "Toate" }
];

export default async function ReviewImportsPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const selectedStatus = params.status || "needs_review";
  const importedCount = Number(params.imported || 0);
  const skippedCount = Number(params.skipped || 0);
  const hasImportSummary = importedCount > 0 || skippedCount > 0;
  const supabase = await createClient();

  const [needsReviewCount, approvedCount, failedCount] = await Promise.all([
    supabase.from("song_files").select("id", { count: "exact", head: true }).eq("import_status", "needs_review"),
    supabase.from("song_files").select("id", { count: "exact", head: true }).eq("import_status", "approved"),
    supabase.from("song_files").select("id", { count: "exact", head: true }).eq("import_status", "failed")
  ]);

  let query = supabase
    .from("song_files")
    .select("id,file_name,import_status,parser_notes,created_at,songs(id,title,default_key,bpm,structure),song_collections(name,short_code)")
    .order("created_at", { ascending: false })
    .limit(300);

  if (selectedStatus !== "all") {
    query = query.eq("import_status", selectedStatus as any);
  }

  const { data: files, error } = await query;

  return (
    <>
      <div className="top-row">
        <div>
          <div className="eyebrow">Importuri</div>
          <h1>Verificare cântări importate</h1>
          <p className="muted">Aici verifici cântările extrase din PPT/PDF/TXT înainte să le marchezi ca bune pentru folosire.</p>
        </div>
        <Link className="btn secondary" href="/songs">Toate cântările</Link>
      </div>

      {hasImportSummary ? (
        <div className="card" style={{ marginBottom: 16, borderColor: "#c7d2fe", background: "#eef2ff" }}>
          <strong>Import finalizat.</strong>{" "}
          <span className="muted">Au fost importate {importedCount} cântări și au fost sărite {skippedCount}.</span>
        </div>
      ) : null}

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="stat"><strong>{needsReviewCount.count ?? 0}</strong><span>cântări de verificat</span></div>
        <div className="stat"><strong>{approvedCount.count ?? 0}</strong><span>cântări verificate</span></div>
        <div className="stat"><strong>{failedCount.count ?? 0}</strong><span>importuri eșuate</span></div>
      </div>

      <section className="card">
        <div className="top-row" style={{ marginBottom: 14 }}>
          <div>
            <h2>Listă importuri</h2>
            <p className="muted small">{files?.length ?? 0} rezultate afișate</p>
          </div>
          <form action="/review" className="inline-form">
            <select className="select compact-select" name="status" defaultValue={selectedStatus}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button className="btn btn-compact" type="submit">Filtrează</button>
          </form>
        </div>

        {error ? <p className="error">{error.message}</p> : null}

<ReviewBulkStatusList files={(files || []) as any[]} />
      </section>
    </>
  );
}
