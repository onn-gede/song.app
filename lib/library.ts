export const PAGE_SIZE = 50;
export type LibraryFilters = {
  q?: string; collection?: string; category?: string; number?: string; status?: string;
  key?: string; sort?: string; page?: string; deleted?: string;
};
export function libraryPage(value?: string) {
  const parsed = Number(value || 1);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 1000000) : 1;
}
export function libraryHref(filters: LibraryFilters, page: number) {
  const params = new URLSearchParams();
  for (const key of ["q", "collection", "category", "number", "status", "key", "sort"] as const) {
    if (filters[key]) params.set(key, filters[key]!);
  }
  params.set("page", String(page));
  return `/songs?${params}`;
}
