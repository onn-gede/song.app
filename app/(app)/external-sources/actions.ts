"use server";

import { revalidatePath, refresh } from "next/cache";
import { requireProfile } from "@/lib/auth";

export async function startExternalSyncAction(formData: FormData) {
  if (process.env.ENABLE_EXTERNAL_SYNC !== "true") throw new Error("Sincronizarea pe loturi este suspendată. Folosește Import → Din link.");
  const { supabase } = await requireProfile("editor");
  if (formData.get("source") !== "resursecrestine") throw new Error("Sursa nu este disponibilă.");
  const pages = Number(formData.get("pages") || 1);
  const maxSongs = Number(formData.get("max_songs") || 25);
  if (!Number.isInteger(pages) || pages < 1 || pages > 10 || !Number.isInteger(maxSongs) || maxSongs < 1 || maxSongs > 200) {
    throw new Error("Alege 1–10 pagini și 1–200 cântări.");
  }
  const { data, error } = await supabase.rpc("enqueue_external_sync", {
    p_pages: pages, p_max_songs: maxSongs, p_overwrite: formData.get("overwrite") === "on"
  });
  if (error) throw new Error(error.message);
  revalidatePath("/external-sources");
  refresh();
  return { runId: String(data) };
}

export async function syncExternalSongsAction(formData: FormData) {
  return startExternalSyncAction(formData);
}

export async function cancelExternalSyncRunAction(runId: string) {
  const { supabase } = await requireProfile("editor");
  const { error } = await supabase.rpc("cancel_external_sync", { p_run_id: runId });
  if (error) throw new Error(error.message);
  revalidatePath("/external-sources");
  refresh();
}

export async function getExternalSyncRunsAction() {
  const { supabase } = await requireProfile("editor");
  const { data, error } = await supabase.from("external_sync_runs")
    .select("id,status,pages_scanned,found_count,imported_count,updated_count,skipped_count,error_count,error_message,started_at,finished_at,heartbeat_at,external_sources!inner(name,slug)")
    .eq("external_sources.slug", "resursecrestine").order("started_at", { ascending: false }).limit(10);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function deleteResurseExternalSongsAction(formData: FormData) {
  if (formData.get("confirmation") !== "STERGE RESURSE") throw new Error("Scrie exact: STERGE RESURSE");
  const { supabase } = await requireProfile("admin");
  const { data, error } = await supabase.rpc("delete_external_source_songs", { p_source_slug: "resursecrestine" });
  if (error) throw new Error(error.message);
  for (const path of ["/external-sources", "/songs", "/dashboard", "/collections"]) revalidatePath(path);
  refresh();
  return data;
}
