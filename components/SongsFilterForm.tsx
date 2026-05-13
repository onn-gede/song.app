"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEY = "songapp:songs-filters:v1";

type Option = { id: string; name: string; short_code?: string | null; slug?: string | null };

export function SongsFilterForm({
  collections,
  categories,
  keys,
  selectedCollection,
  selectedCategory,
  selectedNumber,
  selectedStatus,
  selectedKey,
  selectedSort,
}: {
  collections: Option[];
  categories: Option[];
  keys: string[];
  selectedCollection: string;
  selectedCategory: string;
  selectedNumber: string;
  selectedStatus: string;
  selectedKey: string;
  selectedSort: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restoredRef = useRef(false);

  const hasActiveQuery = useMemo(() => searchParams.toString().length > 0, [searchParams]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (hasActiveQuery) return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) router.replace(`/songs?${saved}`);
  }, [hasActiveQuery, router]);

  function saveFilters(formData: FormData) {
    const params = new URLSearchParams();
    for (const key of ["collection", "category", "number", "status", "key", "sort"]) {
      const value = String(formData.get(key) || "").trim();
      if (value && !(key === "sort" && value === "title_asc")) params.set(key, value);
    }
    if (params.toString()) window.localStorage.setItem(STORAGE_KEY, params.toString());
    else window.localStorage.removeItem(STORAGE_KEY);
  }

  function clearSavedFilters() {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <form
      className="filter-bar filter-bar-expanded compact-filter-bar"
      action="/songs"
      onSubmit={(event) => saveFilters(new FormData(event.currentTarget))}
    >
      <label className="label">Colecție
        <select className="select" name="collection" defaultValue={selectedCollection}>
          <option value="">Toate colecțiile</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>{collection.name}</option>
          ))}
        </select>
      </label>
      <label className="label">Categorie
        <select className="select" name="category" defaultValue={selectedCategory}>
          <option value="">Toate categoriile</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </label>
      <label className="label">Număr
        <input className="input" name="number" defaultValue={selectedNumber} placeholder="ex: 352" />
      </label>
      <label className="label">Status import
        <select className="select" name="status" defaultValue={selectedStatus}>
          <option value="">Toate</option>
          <option value="needs_review">De verificat</option>
          <option value="approved">Verificate</option>
          <option value="failed">Eșuate</option>
        </select>
      </label>
      <label className="label">Tonalitate
        <select className="select" name="key" defaultValue={selectedKey}>
          <option value="">Toate</option>
          {keys.map((key) => <option key={String(key)} value={String(key)}>{String(key)}</option>)}
        </select>
      </label>
      <label className="label">Ordine
        <select className="select" name="sort" defaultValue={selectedSort}>
          <option value="title_asc">Alfabetic A-Z</option>
          <option value="title_desc">Alfabetic Z-A</option>
          <option value="source_number_asc">Număr crescător</option>
          <option value="source_number_desc">Număr descrescător</option>
          <option value="created_desc">Cele mai noi</option>
        </select>
      </label>
      <button className="btn btn-compact" type="submit">Aplică</button>
      <button className="btn secondary btn-compact" type="button" onClick={() => { clearSavedFilters(); router.push("/songs"); }}>Resetează</button>
    </form>
  );
}
