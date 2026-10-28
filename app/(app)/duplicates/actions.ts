"use server";

import { requireProfile } from "@/lib/auth";

import { revalidatePath, refresh } from "next/cache";
import { redirect } from "next/navigation";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function fail(message: string): never {
  redirect(`/duplicates?error=${encodeURIComponent(message)}`);
}

export async function mergeDuplicateSongsAction(formData: FormData) {
  await requireProfile("editor");
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

  const supabase = (await requireProfile("editor")).supabase;
  const { error } = await supabase.rpc("merge_duplicate_songs", {
    p_primary_song_id: primarySongId,
    p_duplicate_song_ids: duplicateSongIds,
  });

  if (error) fail(error.message);

  revalidatePath("/duplicates");
  revalidatePath("/songs");
  revalidatePath("/dashboard");
  refresh();
  redirect("/duplicates?merged=1");
}

export async function mergeDuplicateGroupsAction(groups: Array<{primary:string;duplicates:string[]}>, confirm: string) {
  const {supabase}=await requireProfile("editor");
  if(confirm!=="UNIFICA"||!Array.isArray(groups)||!groups.length||groups.length>200)throw new Error("Selectează grupurile și scrie UNIFICA.");
  const {data,error}=await supabase.rpc("merge_duplicate_song_groups_v47",{p_groups:groups});
  if(error)throw new Error(error.message);
  for(const route of ["/duplicates","/songs","/dashboard","/collections"])revalidatePath(route);
  revalidatePath("/meetings","layout");revalidatePath("/program","layout");refresh();
  return data as {merged:number;groups:number};
}
