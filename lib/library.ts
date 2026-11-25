export const PAGE_SIZE = 50;
export const LIBRARY_ALL_PAGE_SIZE = 2000;
export const LIBRARY_FILTER_COOKIE = "songapp_songs_filters_v2";
export const LIBRARY_FILTER_STORAGE_KEY = "songapp:songs-filters:v2";
export const DEFAULT_LIBRARY_SORT = "source_number_desc";
export type LibraryFilters = {
  q?: string;
  collection?: string;
  category?: string;
  number?: string;
  status?: string;
  key?: string;
  sort?: string;
  view?: string;
  page?: string;
  deleted?: string;
};
export type LibraryFilterValues = Required<
  Pick<LibraryFilters, "q" | "collection" | "category" | "number" | "status" | "key" | "sort" | "view">
>;

export function libraryFilterValues(
  filters: LibraryFilters,
  defaults: Partial<LibraryFilterValues> = {},
): LibraryFilterValues {
  return {
    q: filters.q ?? defaults.q ?? "",
    collection: filters.collection ?? defaults.collection ?? "",
    category: filters.category ?? defaults.category ?? "",
    number: filters.number ?? defaults.number ?? "",
    status: filters.status ?? defaults.status ?? "",
    key: filters.key ?? defaults.key ?? "",
    sort: filters.sort ?? defaults.sort ?? DEFAULT_LIBRARY_SORT,
    view: filters.view === "all" || defaults.view === "all" ? "all" : "paged",
  };
}

export function serializeLibraryFilters(filters: LibraryFilterValues) {
  return encodeURIComponent(JSON.stringify(filters));
}

export function parseLibraryFilters(value?: string | null): Partial<LibraryFilterValues> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>;
    const result: Partial<LibraryFilterValues> = {};
    for (const key of ["q", "collection", "category", "number", "status", "key", "sort", "view"] as const) {
      if (typeof parsed[key] === "string" && parsed[key].length <= 300) result[key] = parsed[key] as never;
    }
    if (result.view !== "all") result.view = "paged";
    return result;
  } catch {
    return null;
  }
}

export function hasExplicitLibraryFilters(filters: LibraryFilters) {
  return ["q", "collection", "category", "number", "status", "key", "sort", "view"].some(
    (key) => filters[key as keyof LibraryFilters] !== undefined,
  );
}
export function libraryPage(value?: string) {
  const parsed = Number(value || 1);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 1000000) : 1;
}
export function libraryHref(filters: LibraryFilters, page: number) {
  const params = new URLSearchParams();
  for (const key of ["q", "collection", "category", "number", "status", "key", "sort", "view"] as const) {
    if (filters[key]) params.set(key, filters[key]!);
  }
  params.set("page", String(page));
  return `/songs?${params}`;
}
