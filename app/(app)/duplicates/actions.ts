"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function fail(message: string): never {
  redirect(`/duplicates?error=${encodeURIComponent(message)}`);
}

export async function mergeDuplicateSongsAction(formData: FormData) {
  const primarySongId = readString(formData, "primary_song_id");
  const duplicateSongIds = formData
    .getAll("duplicate_song_ids")
    .map((value) => String(value))
    .filter(Boolean)
    .filter((id) => id !== primarySongId);
  const confirm = readString(formData, "confirm");

  if (!primarySongId) fail("Alege cântarea principală care rămâne în bibliotecă.");
  if (duplicateSongIds.length === 0) fail("Selectează cel puțin o cântare duplicat de unificat.");
  if (confirm !== "UNIFICA") fail("Pentru confirmare scrie exact: UNIFICA");

  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_duplicate_songs", {
    p_primary_song_id: primarySongId,
    p_duplicate_song_ids: duplicateSongIds,
  });

  if (error) fail(error.message);

  revalidatePath("/duplicates");
  revalidatePath("/songs");
  revalidatePath("/dashboard");
  redirect("/duplicates?merged=1");
}
