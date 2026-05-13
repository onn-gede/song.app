"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function slugifyRo(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ă/g, "a")
    .replace(/Ă/g, "a")
    .replace(/â/g, "a")
    .replace(/Â/g, "a")
    .replace(/î/g, "i")
    .replace(/Î/g, "i")
    .replace(/ș/g, "s")
    .replace(/Ș/g, "s")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s")
    .replace(/ț/g, "t")
    .replace(/Ț/g, "t")
    .replace(/ţ/g, "t")
    .replace(/Ţ/g, "t")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length >= 2 ? normalized : "categorie";
}

export async function createCategoryAction(formData: FormData) {
  const name = readString(formData, "name");
  const parentId = readString(formData, "parent_id");

  if (!name) throw new Error("Numele categoriei este obligatoriu.");

  const supabase = await createClient();
  const baseSlug = slugifyRo(name);

  const { data: existing } = await supabase
    .from("categories")
    .select("slug")
    .like("slug", `${baseSlug}%`);

  const usedSlugs = new Set((existing || []).map((item: any) => item.slug));
  let slug = baseSlug;
  let counter = 2;

  while (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  const { error } = await supabase.from("categories").insert({
    name,
    slug,
    parent_id: parentId || null
  });

  if (error) throw new Error(error.message);

  revalidatePath("/categories");
  revalidatePath("/songs");
}


export async function deleteCategoryAction(formData: FormData) {
  const categoryId = readString(formData, "category_id");
  const confirm = readString(formData, "confirm");

  if (!categoryId) throw new Error("Lipsește categoria.");
  if (confirm !== "STERGE") throw new Error("Pentru ștergere trebuie să scrii exact: STERGE");

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId);

  if (error) throw new Error(error.message);

  revalidatePath("/categories");
  revalidatePath("/songs");
  revalidatePath("/dashboard");
}
