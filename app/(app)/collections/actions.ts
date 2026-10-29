"use server";

import { validCollectionColor } from "@/lib/collection-colors";
import { requireProfile } from "@/lib/auth";

import { revalidatePath, refresh } from "next/cache";

const allowedSourceTypes = new Set(["manual", "pptx", "ppt", "pdf", "txt", "docx", "other"]);

function readString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function normalizeCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ăâ]/gi, "a")
    .replace(/[î]/gi, "i")
    .replace(/[șş]/gi, "s")
    .replace(/[țţ]/gi, "t")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

async function uniqueShortCode(baseCode: string) {
  const supabase = (await requireProfile("editor")).supabase;
  const base = normalizeCode(baseCode) || "COLECTIE";
  const { data } = await supabase
    .from("song_collections")
    .select("short_code")
    .like("short_code", `${base}%`);

  const used = new Set((data || []).map((item: any) => item.short_code));
  let candidate = base;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${counter}`.slice(0, 28);
    counter += 1;
  }
  return candidate;
}

export async function createCollectionAction(formData: FormData) {
  await requireProfile("editor");
  const name = readString(formData, "name");
  const color=readString(formData,"color");const opacity=Number(formData.get("opacity")||100);if(![25,50,75,100].includes(opacity))throw new Error("Intensitate invalidă.");
  if(!validCollectionColor(color))throw new Error("Alege o culoare validă.");
  const requestedShortCode = readString(formData, "short_code");
  const description = readString(formData, "description");
  const sourceType = readString(formData, "source_type") || "manual";

  if (!name) throw new Error("Numele colecției este obligatoriu.");
  if (!allowedSourceTypes.has(sourceType)) throw new Error("Tipul colecției nu este valid.");

  const supabase = (await requireProfile("editor")).supabase;
  const shortCode = await uniqueShortCode(requestedShortCode || name);

  const { error } = await supabase.from("song_collections").insert({
    name,
    color,opacity,
    short_code: shortCode,
    description: description || null,
    source_type: sourceType,
    is_active: true
  });

  if (error) throw new Error(error.message);

  revalidatePath("/collections");
  revalidatePath("/songs");
  revalidatePath("/dashboard");
  revalidatePath("/meetings", "layout");
  revalidatePath("/program", "layout");
  refresh();
}

export async function updateCollectionAction(formData: FormData) {
  await requireProfile("editor");
  const collectionId = readString(formData, "collection_id");
  const name = readString(formData, "name");
  const color=readString(formData,"color");const opacity=Number(formData.get("opacity")||100);if(![25,50,75,100].includes(opacity))throw new Error("Intensitate invalidă.");
  if(!validCollectionColor(color))throw new Error("Alege o culoare validă.");
  const shortCode = readString(formData, "short_code");
  const description = readString(formData, "description");
  const sourceType = readString(formData, "source_type") || "manual";
  const isActive = formData.get("is_active") === "on";

  if (!collectionId) throw new Error("Lipsește colecția.");
  if (!name) throw new Error("Numele colecției este obligatoriu.");
  if (!shortCode) throw new Error("Codul scurt este obligatoriu.");
  if (!allowedSourceTypes.has(sourceType)) throw new Error("Tipul colecției nu este valid.");

  const supabase = (await requireProfile("editor")).supabase;
  const { error } = await supabase
    .from("song_collections")
    .update({
      name,
      color,opacity,
      short_code: normalizeCode(shortCode),
      description: description || null,
      source_type: sourceType,
      is_active: isActive
    })
    .eq("id", collectionId).select("id").single();

  if (error) throw new Error(error.message);

  revalidatePath("/collections");
  revalidatePath("/songs");
  revalidatePath("/dashboard");
  revalidatePath("/meetings", "layout");
  revalidatePath("/program", "layout");
  refresh();
}


export async function deleteCollectionAction(formData: FormData) {
  await requireProfile("editor");
  const collectionId = readString(formData, "collection_id");
  const confirm = readString(formData, "confirm");

  if (!collectionId) throw new Error("Lipsește colecția.");
  if (confirm !== "STERGE") throw new Error("Pentru ștergere trebuie să scrii exact: STERGE");

  const supabase = (await requireProfile("editor")).supabase;
  const { error } = await supabase
    .from("song_collections")
    .delete()
    .eq("id", collectionId).select("id").single();

  if (error) throw new Error(error.message);

  revalidatePath("/collections");
  revalidatePath("/songs");
  revalidatePath("/dashboard");
  revalidatePath("/meetings", "layout");
  revalidatePath("/program", "layout");
  refresh();
}
