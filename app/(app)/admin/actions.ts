"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Trebuie să fii autentificat.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .single();

  if (error) throw new Error(error.message);
  if (!profile?.is_active || profile.role !== "admin") {
    throw new Error("Doar administratorul poate șterge toate datele aplicației.");
  }

  return supabase;
}

export async function deleteAllAppDataAction(formData: FormData) {
  const confirm = readString(formData, "confirm");
  if (confirm !== "STERGE TOT") {
    throw new Error("Pentru resetare completă trebuie să scrii exact: STERGE TOT");
  }

  const supabase = await requireAdmin();

  const steps: Array<[string, () => PromiseLike<{ error: { message: string } | null }>]> = [
    ["meeting_share_links", () => supabase.from("meeting_share_links").delete().neq("id", "00000000-0000-0000-0000-000000000000")],
    ["meeting_items", () => supabase.from("meeting_items").delete().neq("id", "00000000-0000-0000-0000-000000000000")],
    ["meetings", () => supabase.from("meetings").delete().neq("id", "00000000-0000-0000-0000-000000000000")],
    ["song_bible_references", () => supabase.from("song_bible_references").delete().neq("id", "00000000-0000-0000-0000-000000000000")],
    ["bible_references", () => supabase.from("bible_references").delete().neq("id", "00000000-0000-0000-0000-000000000000")],
    ["song_categories", () => supabase.from("song_categories").delete().neq("song_id", "00000000-0000-0000-0000-000000000000")],
    ["song_files", () => supabase.from("song_files").delete().neq("id", "00000000-0000-0000-0000-000000000000")],
    ["song_sections", () => supabase.from("song_sections").delete().neq("id", "00000000-0000-0000-0000-000000000000")],
    ["song_sources", () => supabase.from("song_sources").delete().neq("id", "00000000-0000-0000-0000-000000000000")],
    ["songs", () => supabase.from("songs").delete().neq("id", "00000000-0000-0000-0000-000000000000")],
    ["categories", () => supabase.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000")],
    ["song_collections", () => supabase.from("song_collections").delete().neq("id", "00000000-0000-0000-0000-000000000000")]
  ];

  for (const [label, run] of steps) {
    const { error } = await run();
    if (error) throw new Error(`Nu am putut șterge ${label}: ${error.message}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/songs");
  revalidatePath("/meetings");
  revalidatePath("/collections");
  revalidatePath("/categories");
  revalidatePath("/review");
  revalidatePath("/admin");
}

export async function deleteProgramsOnlyAction(formData: FormData) {
  const confirm = readString(formData, "confirm");
  if (confirm !== "STERGE PROGRAME") {
    throw new Error("Pentru ștergerea programelor trebuie să scrii exact: STERGE PROGRAME");
  }

  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("meetings")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/meetings");
  revalidatePath("/admin");
}
