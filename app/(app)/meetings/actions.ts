"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBibleVerseSuggestions as fetchBibleVerseSuggestions } from "@/lib/aiBible";

export type MeetingOption = {
  id: string;
  title: string;
  meeting_date: string;
  status: string;
};

export type SongSearchResult = {
  song_id: string;
  title: string;
  default_key: string | null;
  bpm: number | null;
  rank?: number;
  matched_source: string | null;
};

export type RecentUsage = {
  song_id: string;
  title: string;
  last_used_at: string;
  times_used: number;
  last_meeting_title: string | null;
};

function readString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createMeetingAction(formData: FormData) {
  const title = readString(formData, "title");
  const meetingType = readString(formData, "meeting_type");
  const meetingDate = String(formData.get("meeting_date") || "");
  const notes = readString(formData, "notes");

  if (!title || !meetingDate) throw new Error("Titlul și data sunt obligatorii.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_meeting", {
    p_title: title,
    p_meeting_type: meetingType || null,
    p_meeting_date: new Date(meetingDate).toISOString(),
    p_notes: notes || null
  });

  if (error || !data) throw new Error(error?.message || "Nu am putut crea programul.");

  revalidatePath("/meetings");
  redirect(`/meetings/${data}`);
}

export async function listMeetingsAction(): Promise<MeetingOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("id,title,meeting_date,status")
    .order("meeting_date", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);
  return (data || []) as MeetingOption[];
}

function normalizeSearchNumber(value: string) {
  return value.trim().replace(/^nr\.?\s*/i, "");
}

function sourceLabel(source: any) {
  const collection = Array.isArray(source.song_collections) ? source.song_collections[0] : source.song_collections;
  const code = collection?.short_code || collection?.name || "Sursă";
  return `${code}${source.song_number ? ` nr. ${source.song_number}` : ""}`;
}

export async function searchSongsAction(query: string, limit = 25): Promise<SongSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = await createClient();
  const results = new Map<string, SongSearchResult>();

  const { data, error } = await supabase.rpc("search_songs", {
    search_query: trimmed,
    result_limit: limit
  });

  if (error) throw new Error(error.message);

  ((data || []) as SongSearchResult[]).forEach((item) => {
    results.set(item.song_id, item);
  });

  const numberQuery = normalizeSearchNumber(trimmed);
  if (numberQuery.length > 0) {
    const { data: sourceMatches, error: sourceError } = await supabase
      .from("song_sources")
      .select("song_id,song_number,source_title,song_collections(short_code,name),songs(id,title,default_key,bpm)")
      .or(`song_number.ilike.%${numberQuery}%,source_title.ilike.%${trimmed}%`)
      .limit(limit);

    if (sourceError) throw new Error(sourceError.message);

    (sourceMatches || []).forEach((source: any) => {
      const song = Array.isArray(source.songs) ? source.songs[0] : source.songs;
      if (!song?.id || results.has(song.id)) return;
      results.set(song.id, {
        song_id: song.id,
        title: song.title,
        default_key: song.default_key || null,
        bpm: song.bpm || null,
        rank: 0,
        matched_source: sourceLabel(source)
      });
    });
  }

  return Array.from(results.values()).slice(0, limit);
}

export async function getRecentUsageAction(daysBack = 30): Promise<Record<string, RecentUsage>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_song_recent_usage", { days_back: daysBack });

  if (error) throw new Error(error.message);

  const map: Record<string, RecentUsage> = {};
  ((data || []) as RecentUsage[]).forEach((item) => {
    map[item.song_id] = item;
  });
  return map;
}

export async function getBibleVerseSuggestionsAction(songTitle: string): Promise<string[]> {
  if (!songTitle?.trim()) return [];
  return await fetchBibleVerseSuggestions(songTitle);
}

export async function addSongToMeetingAction(input: {
  meetingId: string;
  songId: string;
  isBackup?: boolean;
  selectedKey?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_song_to_meeting", {
    p_meeting_id: input.meetingId,
    p_song_id: input.songId,
    p_is_backup: Boolean(input.isBackup),
    p_selected_key: input.selectedKey || null,
    p_notes: input.notes || null
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${input.meetingId}`);
}

export async function createMeetingAndAddSongAction(input: {
  title: string;
  meetingType?: string | null;
  meetingDate: string;
  songId: string;
  isBackup?: boolean;
}) {
  const title = input.title.trim();
  const meetingDate = input.meetingDate;

  if (!title || !meetingDate) throw new Error("Completează titlul și data întâlnirii.");

  const supabase = await createClient();
  const { data: meetingId, error: meetingError } = await supabase.rpc("create_meeting", {
    p_title: title,
    p_meeting_type: input.meetingType || null,
    p_meeting_date: new Date(meetingDate).toISOString(),
    p_notes: null
  });

  if (meetingError || !meetingId) {
    throw new Error(meetingError?.message || "Nu am putut crea programul.");
  }

  const { error: addError } = await supabase.rpc("add_song_to_meeting", {
    p_meeting_id: meetingId,
    p_song_id: input.songId,
    p_is_backup: Boolean(input.isBackup),
    p_selected_key: null,
    p_notes: null
  });

  if (addError) throw new Error(addError.message);

  revalidatePath("/meetings");
  revalidatePath(`/meetings/${meetingId}`);
  return meetingId as string;
}

export async function addTextItemAction(formData: FormData) {
  const meetingId = readString(formData, "meeting_id");
  const itemType = readString(formData, "item_type") || "text";
  const title = readString(formData, "custom_title");
  const text = readString(formData, "custom_text");

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_text_to_meeting", {
    p_meeting_id: meetingId,
    p_item_type: itemType,
    p_custom_title: title || null,
    p_custom_text: text || null
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
}



export async function updateMeetingTextItemAction(formData: FormData) {
  const meetingId = readString(formData, "meeting_id");
  const itemId = readString(formData, "item_id");
  const itemType = readString(formData, "item_type") || "text";
  const title = readString(formData, "custom_title");
  const text = readString(formData, "custom_text");

  if (!meetingId || !itemId) throw new Error("Lipsește elementul de actualizat.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_items")
    .update({
      item_type: itemType,
      custom_title: title || null,
      custom_text: text || null
    })
    .eq("id", itemId)
    .eq("meeting_id", meetingId)
    .is("song_id", null);

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
}

export async function createShareLinkAction(formData: FormData) {
  const meetingId = readString(formData, "meeting_id");
  const preferredSlug = readString(formData, "preferred_slug");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_meeting_share_link", {
    p_meeting_id: meetingId,
    p_preferred_slug: preferredSlug || null
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
}

export async function removeMeetingItemAction(formData: FormData) {
  const meetingId = readString(formData, "meeting_id");
  const itemId = readString(formData, "item_id");

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_meeting_item", {
    p_meeting_id: meetingId,
    p_item_id: itemId
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
}

export async function moveMeetingItemAction(formData: FormData) {
  const meetingId = readString(formData, "meeting_id");
  const itemId = readString(formData, "item_id");
  const direction = readString(formData, "direction") as "up" | "down";

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_meeting_item", {
    p_meeting_id: meetingId,
    p_item_id: itemId,
    p_direction: direction
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
}



export async function reorderMeetingItemsAction(input: {
  meetingId: string;
  itemIds: string[];
  isBackup: boolean;
}) {
  if (!input.meetingId) throw new Error("Lipsește programul.");
  if (!Array.isArray(input.itemIds) || input.itemIds.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_meeting_items", {
    p_meeting_id: input.meetingId,
    p_item_ids: input.itemIds,
    p_is_backup: input.isBackup
  });

  if (error) {
    const looksLikeSchemaCache = error.message.includes("reorder_meeting_items") || error.message.includes("schema cache");
    if (!looksLikeSchemaCache) throw new Error(error.message);

    // Fallback fără RPC, util dacă PostgREST nu și-a reîncărcat încă schema cache.
    // Facem întâi poziții temporare negative ca să evităm unique(meeting_id, position).
    for (let index = 0; index < input.itemIds.length; index += 1) {
      const { error: tempError } = await supabase
        .from("meeting_items")
        .update({ position: -1000000 - index })
        .eq("id", input.itemIds[index])
        .eq("meeting_id", input.meetingId)
        .eq("is_backup", input.isBackup);
      if (tempError) throw new Error(tempError.message);
    }

    const base = input.isBackup ? 900 : 0;
    for (let index = 0; index < input.itemIds.length; index += 1) {
      const { error: finalError } = await supabase
        .from("meeting_items")
        .update({ position: base + index + 1 })
        .eq("id", input.itemIds[index])
        .eq("meeting_id", input.meetingId)
        .eq("is_backup", input.isBackup);
      if (finalError) throw new Error(finalError.message);
    }
  }

  revalidatePath(`/meetings/${input.meetingId}`);
}

export async function deleteMeetingAction(formData: FormData) {
  const meetingId = readString(formData, "meeting_id");
  const confirm = readString(formData, "confirm");

  if (!meetingId) throw new Error("Lipsește programul.");
  if (confirm !== "STERGE") throw new Error("Pentru ștergere trebuie să scrii exact: STERGE");

  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", meetingId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/meetings");
  redirect("/meetings");
}

export async function deleteShareLinkAction(formData: FormData) {
  const meetingId = readString(formData, "meeting_id");
  const linkId = readString(formData, "link_id");

  if (!meetingId || !linkId) throw new Error("Lipsește linkul public.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_share_links")
    .delete()
    .eq("id", linkId)
    .eq("meeting_id", meetingId);

  if (error) throw new Error(error.message);

  revalidatePath(`/meetings/${meetingId}`);
}

export async function acceptPublicContributionAction(formData: FormData) {
  const meetingId = readString(formData, "meeting_id");
  const contributionId = readString(formData, "contribution_id");

  if (!meetingId || !contributionId) throw new Error("Lipsește propunerea.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_public_meeting_contribution", {
    p_contribution_id: contributionId
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
}

export async function rejectPublicContributionAction(formData: FormData) {
  const meetingId = readString(formData, "meeting_id");
  const contributionId = readString(formData, "contribution_id");

  if (!meetingId || !contributionId) throw new Error("Lipsește propunerea.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_public_meeting_contribution", {
    p_contribution_id: contributionId
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
}
