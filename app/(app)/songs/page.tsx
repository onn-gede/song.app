import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SongSearch } from "@/components/SongSearch";
import { SongsFilterForm } from "@/components/SongsFilterForm";
import { SongsBulkList } from "@/components/SongsBulkList";

type PageProps = {
  searchParams?: Promise<{
    collection?: string;
    category?: string;
    number?: string;
    status?: string;
    key?: string;
    sort?: string;
    deleted?: string;
  }>;
};

function intersectIds(a: string[] | null, b: string[]) {
  if (a === null) return b;
  const set = new Set(b);
  return a.filter((id) => set.has(id));
}

function numericSourceNumber(song: any) {
  const raw = (song.song_sources || [])[0]?.song_number || "";
  const numeric = Number.parseInt(String(raw).replace(/\D/g, ""), 10);
  return Number.isNaN(numeric) ? Number.MAX_SAFE_INTEGER : numeric;
}

function firstSourceLabel(song: any) {
  const source = (song.song_sources || [])[0];
  if (!source) return "";
  const code = source.song_collections?.short_code || source.song_collections?.name || "Sursă";
  return `${code}${source.song_number ? ` nr. ${source.song_number}` : ""}`;
}

export default async function SongsPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const selectedCollection = params.collection || "";
  const selectedCategory = params.category || "";
  const selectedNumber = (params.number || "").trim();
  const selectedStatus = params.status || "";
  const selectedKey = (params.key || "").trim();
  const selectedSort = params.sort || "title_asc";

  const supabase = await createClient();

  const [{ data: collections }, { data: categories }, { data: keyRows }] = await Promise.all([
    supabase.from("song_collections").select("id,name,short_code").eq("is_active", true).order("name"),
    supabase.from("categories").select("id,name,slug").order("name"),
    supabase.from("songs").select("default_key").eq("is_active", true).not("default_key", "is", null)
  ]);

  let songs: any[] = [];
  let errorMessage: string | null = null;

  // Important: avoid filtering with `.in("id", filteredIds)` for large collections.
  // Supabase/PostgREST sends that as a long GET URL and can return Bad Request / fetch failed.
  // We fetch the library once and apply the UI filters in memory. This is stable for church-song libraries
  // of hundreds or a few thousand songs and keeps collection/category/status filters reliable.
  const { data, error } = await supabase
    .from("songs")
    .select("id,title,default_key,bpm,structure,created_at,song_sources(song_number,source_title,collection_id,song_collections(id,name,short_code)),song_categories(category_id,categories(id,name,slug)),song_files(import_status)")
    .eq("is_active", true)
    .limit(5000)
    .order("title", { ascending: true });

  songs = data || [];
  errorMessage = error?.message || null;

  if (!errorMessage) {
    if (selectedCollection) {
      songs = songs.filter((song: any) =>
        (song.song_sources || []).some((source: any) => source.collection_id === selectedCollection || source.song_collections?.id === selectedCollection)
      );
    }

    if (selectedCategory) {
      songs = songs.filter((song: any) =>
        (song.song_categories || []).some((entry: any) => entry.category_id === selectedCategory || entry.categories?.id === selectedCategory)
      );
    }

    if (selectedNumber) {
      const numberNeedle = selectedNumber.toLocaleLowerCase("ro");
      songs = songs.filter((song: any) =>
        (song.song_sources || []).some((source: any) =>
          String(source.song_number || "").toLocaleLowerCase("ro").includes(numberNeedle) ||
          String(source.source_title || "").toLocaleLowerCase("ro").includes(numberNeedle)
        )
      );
    }

    if (selectedStatus) {
      songs = songs.filter((song: any) =>
        (song.song_files || []).some((file: any) => file.import_status === selectedStatus)
      );
    }

    if (selectedKey) {
      songs = songs.filter((song: any) => String(song.default_key || "") === selectedKey);
    }
  }

  if (selectedSort === "created_desc") {
    songs = [...songs].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  } else if (selectedSort === "title_desc") {
    songs = [...songs].sort((a, b) => String(b.title || "").localeCompare(String(a.title || ""), "ro"));
  } else if (selectedSort === "source_number_asc") {
    songs = [...songs].sort((a, b) => numericSourceNumber(a) - numericSourceNumber(b) || String(a.title || "").localeCompare(String(b.title || ""), "ro"));
  } else if (selectedSort === "source_number_desc") {
    songs = [...songs].sort((a, b) => numericSourceNumber(b) - numericSourceNumber(a) || String(a.title || "").localeCompare(String(b.title || ""), "ro"));
  } else {
    songs = [...songs].sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ro"));
  }

  const selectedCollectionName = (collections || []).find((item: any) => item.id === selectedCollection)?.name;
  const selectedCategoryName = (categories || []).find((item: any) => item.id === selectedCategory)?.name;
  const keys = [...new Set((keyRows || []).map((item: any) => item.default_key).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "ro"));

  return (
    <>
      <div className="top-row">
        <div>
          <div className="eyebrow">Bibliotecă</div>
          <h1>Toate cântările</h1>
          <p className="muted">Listă completă, filtrare pe colecții, categorii, număr, status și tonalitate.</p>
        </div>
        <div className="inline-form"><Link className="btn secondary" href="/collections">Colecții</Link><Link className="btn secondary" href="/categories">Categorii</Link><Link className="btn" href="/import">Import text</Link></div>
      </div>

      <SongSearch />

      <section className="card songs-list-card" style={{ marginTop: 12 }}>
        <div className="top-row" style={{ marginBottom: 14 }}>
          <div>
            <h2>Listă completă / secțiuni</h2>
            <p className="muted small">
              {songs.length} cântări afișate
              {selectedCollectionName ? ` · Colecție: ${selectedCollectionName}` : ""}
              {selectedCategoryName ? ` · Categorie: ${selectedCategoryName}` : ""}
              {selectedNumber ? ` · Număr: ${selectedNumber}` : ""}
              {selectedStatus ? ` · Status: ${selectedStatus}` : ""}
              {selectedKey ? ` · Tonalitate: ${selectedKey}` : ""}
            </p>
          </div>
          {(selectedCollection || selectedCategory || selectedNumber || selectedStatus || selectedKey || selectedSort !== "title_asc") ? <Link className="btn secondary btn-compact" href="/songs">Resetează filtre</Link> : null}
        </div>

        <SongsFilterForm
          collections={(collections || []) as any}
          categories={(categories || []) as any}
          keys={keys.map((key) => String(key))}
          selectedCollection={selectedCollection}
          selectedCategory={selectedCategory}
          selectedNumber={selectedNumber}
          selectedStatus={selectedStatus}
          selectedKey={selectedKey}
          selectedSort={selectedSort}
        />

        {params.deleted ? <p className="success">Au fost șterse {params.deleted} cântări.</p> : null}
        {errorMessage ? <p className="error">{errorMessage}</p> : null}
        <SongsBulkList songs={songs as any} />
      </section>
    </>
  );
}
