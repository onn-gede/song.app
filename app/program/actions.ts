"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PublicSongSearchResult = {
  song_id: string;
  title: string;
  default_key: string | null;
  bpm: number | null;
  matched_source: string | null;
  lyrics_text: string | null;
};

export type PublicPositionOption = {
  value: string;
  label: string;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function publicSearchSongsAction(slug: string, query: string): Promise<PublicSongSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_search_songs_for_share", {
    p_public_slug: slug,
    search_query: trimmed,
    result_limit: 20
  });

  if (error) throw new Error(error.message);
  return (data || []) as PublicSongSearchResult[];
}

export async function addPublicSongContributionAction(input: {
  slug: string;
  songId: string;
  isBackup?: boolean;
  proposedPosition?: number | null;
  contributorName?: string | null;
  notes?: string | null;
}) {
  if (!input.slug || !input.songId) throw new Error("Lipsește cântarea selectată.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_public_meeting_contribution", {
    p_public_slug: input.slug,
    p_contribution_type: "song",
    p_song_id: input.songId,
    p_custom_title: null,
    p_custom_text: null,
    p_is_backup: Boolean(input.isBackup),
    p_proposed_position: input.proposedPosition || null,
    p_contributor_name: input.contributorName || null,
    p_notes: input.notes || null
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/program/${input.slug}`);
}

export async function addPublicTextContributionAction(formData: FormData) {
  const slug = clean(formData.get("slug"));
  const contributionType = clean(formData.get("contribution_type")) || "text";
  const contributorName = clean(formData.get("contributor_name"));
  const proposedPositionRaw = clean(formData.get("proposed_position"));
  const proposedPosition = proposedPositionRaw ? Number(proposedPositionRaw) : null;
  const customTitle = clean(formData.get("custom_title"));
  const customText = clean(formData.get("custom_text"));
  const notes = clean(formData.get("notes"));
  const isBackup = formData.get("is_backup") === "on";

  if (!slug) throw new Error("Link public invalid.");
  if (!customTitle && !customText) throw new Error("Completează titlul sau textul intervenției.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_public_meeting_contribution", {
    p_public_slug: slug,
    p_contribution_type: contributionType,
    p_song_id: null,
    p_custom_title: customTitle || null,
    p_custom_text: customText || null,
    p_is_backup: isBackup,
    p_proposed_position: Number.isFinite(proposedPosition || NaN) ? proposedPosition : null,
    p_contributor_name: contributorName || null,
    p_notes: notes || null
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/program/${slug}`);
}
