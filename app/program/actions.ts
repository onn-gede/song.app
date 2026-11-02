"use server";

import {PUBLIC_LIMITS, publicText, publicPosition, publicContributionError} from "@/lib/public-contribution";
import { revalidatePath, refresh } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

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
  slug=publicText(slug,PUBLIC_LIMITS.slug,"Link");
  const trimmed = publicText(query,PUBLIC_LIMITS.query,"Căutare");
  if (trimmed.length < 2) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("public_search_songs_for_share", {
    p_public_slug: slug,
    search_query: trimmed,
    result_limit: 20
  });

  if (error) throw new Error("Căutarea nu poate fi efectuată momentan.");
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
  input={...input,slug:publicText(input.slug,PUBLIC_LIMITS.slug,"Link"),contributorName:publicText(input.contributorName,PUBLIC_LIMITS.name,"Nume"),notes:publicText(input.notes,PUBLIC_LIMITS.notes,"Notă"),proposedPosition:publicPosition(input.proposedPosition)};
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.songId)) throw new Error("Cântare invalidă.");
  if (!input.slug || !input.songId) throw new Error("Lipsește cântarea selectată.");

  const supabase = createPublicClient();
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

  if (error) throw publicContributionError(error);
  revalidatePath(`/program/${input.slug}`);
  refresh();
}

export async function addPublicTextContributionAction(formData: FormData) {
  const slug = publicText(formData.get("slug"),PUBLIC_LIMITS.slug,"Link");
  const contributionType = clean(formData.get("contribution_type")) || "text";
  const contributorName = publicText(formData.get("contributor_name"),PUBLIC_LIMITS.name,"Nume");
  const proposedPositionRaw = clean(formData.get("proposed_position"));
  const proposedPosition = publicPosition(proposedPositionRaw);
  const customTitle = publicText(formData.get("custom_title"),PUBLIC_LIMITS.title,"Titlu");
  const customText = publicText(formData.get("custom_text"),PUBLIC_LIMITS.text,"Observații");
  const notes = publicText(formData.get("notes"),PUBLIC_LIMITS.notes,"Notă");
  const isBackup = formData.get("is_backup") === "on";

  if (!slug) throw new Error("Link public invalid.");
  if (!customTitle && !customText) throw new Error("Completează titlul sau textul intervenției.");

  const supabase = createPublicClient();
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

  if (error) throw publicContributionError(error);
  revalidatePath(`/program/${slug}`);
  refresh();
}
