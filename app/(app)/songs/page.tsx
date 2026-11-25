import { UsageRefresh } from "@/components/UsageRefresh";
import { redirect } from "next/navigation";
import { LibraryPagination } from "@/components/LibraryPagination";
import Link from "next/link";
import { LibraryToolbar } from "@/components/LibraryToolbar";
import { SongsBulkList } from "@/components/SongsBulkList";
import { Icon } from "@/components/Icon";
import { requireProfile, canEdit } from "@/lib/auth";
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_ALL_PAGE_SIZE,
  LIBRARY_FILTER_COOKIE,
  PAGE_SIZE,
  hasExplicitLibraryFilters,
  libraryFilterValues,
  libraryPage,
  libraryHref,
  parseLibraryFilters,
  type LibraryFilters,
} from "@/lib/library";
import { cookies } from "next/headers";
export default async function SongsPage({ searchParams }: { searchParams?: Promise<LibraryFilters> }) {
  const requestedParams = (await searchParams) || {};
  const { supabase, profile } = await requireProfile();
  const editable = canEdit(profile.role);
  const [{ data: collections }, { data: categories }] = await Promise.all([
    supabase.from("song_collections").select("id,name,short_code,color,opacity,is_active").order("name"),
    supabase.from("categories").select("id,name,slug").order("name"),
  ]);
  const youthCollection = (collections || []).find((collection) => {
    const identity = `${collection.short_code || ""} ${collection.name || ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return identity.includes("tineri");
  });
  const defaults = libraryFilterValues(
    {},
    {
      collection: youthCollection?.id || "",
      sort: DEFAULT_LIBRARY_SORT,
    },
  );
  const saved = hasExplicitLibraryFilters(requestedParams)
    ? null
    : parseLibraryFilters((await cookies()).get(LIBRARY_FILTER_COOKIE)?.value);
  const params: LibraryFilters = hasExplicitLibraryFilters(requestedParams)
    ? requestedParams
    : { ...defaults, ...(saved || {}) };
  const filters = libraryFilterValues(params, defaults);
  const unpaginated = filters.view === "all";
  const pageSize = unpaginated ? LIBRARY_ALL_PAGE_SIZE : PAGE_SIZE;
  const page = unpaginated ? 1 : libraryPage(requestedParams.page);
  const { data: result, error } = await supabase.rpc("list_song_library_v46", {
    p_collection: filters.collection || null,
    p_category: filters.category || null,
    p_number: filters.number || null,
    p_status: filters.status || null,
    p_key: filters.key || null,
    p_sort: filters.sort,
    p_page: page,
    p_page_size: pageSize,
    p_query: filters.q || null,
  });
  const songs = result?.songs || [],
    total = Number(result?.total || 0),
    pageCount = unpaginated ? 1 : Math.max(1, Math.ceil(total / pageSize));
  if (!error && !unpaginated && page > pageCount) redirect(libraryHref(params, pageCount));
  return (
    <div className="library-page-v44">
      <UsageRefresh />
      <div className="page-heading-v44">
        <div>
          <div className="eyebrow">Biblioteca ta de muzică</div>
          <h1>
            Cântări<span className="heading-count">{total.toLocaleString("ro-RO")}</span>
          </h1>
          <p>Găsește cântarea potrivită pentru următorul program.</p>
        </div>
        {editable ? (
          <Link className="btn" href="/import">
            <Icon name="plus" size={18} />
            Importă o cântare
          </Link>
        ) : null}
      </div>
      <LibraryToolbar
        collections={(collections || []).filter((c) => c.is_active)}
        categories={categories || []}
        keys={result?.keys || []}
        initialFilters={filters}
        defaultCollection={defaults.collection}
      />
      {filters.q &&
      (filters.collection ||
        filters.category ||
        filters.key ||
        filters.number ||
        filters.status ||
        ["most_sung", "last_sung"].includes(filters.sort)) ? (
        <Link className="text-link-v44" href={libraryHref({ q: filters.q, sort: filters.sort }, 1)}>
          Caută „{filters.q}” în toate colecțiile
        </Link>
      ) : null}
      <div className="library-quick-sorts" aria-label="Ordonări rapide">
        {[
          ["created_desc", "Adăugate recent"],
          ["last_sung", "Cântate recent în programe"],
          ["most_sung", "Cele mai des cântate"],
        ].map(([sort, label]) => (
          <Link
            key={sort}
            className={"btn " + (filters.sort === sort ? "" : "secondary")}
            aria-current={filters.sort === sort ? "page" : undefined}
            href={libraryHref({ ...filters, sort }, 1)}
          >
            {label}
          </Link>
        ))}
      </div>
      {params.deleted ? (
        <p className="success" role="status">
          Au fost șterse {params.deleted} cântări.
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error.message.includes("list_song_library_v46")
            ? "Rulează UPDATE-V46.sql în baza existentă pentru noua căutare și filtrare."
            : "Biblioteca nu poate fi încărcată momentan. Încearcă din nou."}
        </p>
      ) : (
        <section className="library-results-v44" aria-label="Lista cântărilor">
          <div className="library-results-heading">
            <span>
              {filters.q
                ? `Rezultate pentru „${filters.q}”`
                : (
                    {
                      most_sung: "Cele mai des cântate",
                      last_sung: "Cântate recent în programe",
                      created_desc: "Cele mai recente cântări adăugate",
                    } as Record<string, string>
                  )[filters.sort] || "Biblioteca de cântări"}
            </span>
            <small role="status">
              {total && unpaginated
                ? `${total.toLocaleString("ro-RO")} cântări · scroll continuu`
                : total
                  ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} din ${total.toLocaleString("ro-RO")}`
                  : "Niciun rezultat"}
            </small>
          </div>
          {!unpaginated ? (
            <LibraryPagination position="top" filters={filters} page={page} pages={pageCount} />
          ) : null}
          <SongsBulkList
            key={`${page}:${JSON.stringify(filters)}`}
            songs={songs}
            categories={categories || []}
            collections={collections || []}
            canManage={editable}
          />
          {!unpaginated ? <LibraryPagination filters={filters} page={page} pages={pageCount} /> : null}
        </section>
      )}
    </div>
  );
}
