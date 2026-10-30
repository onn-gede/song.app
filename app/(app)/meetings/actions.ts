"use server";

import type { MeetingSnapshot } from "@/lib/meeting-state";
import { requireProfile } from "@/lib/auth";

import { revalidatePath, refresh } from "next/cache";
import { redirect } from "next/navigation";
import { meetingDateISO } from "@/lib/meeting-date";

export type MeetingOption = {
  id: string;
  title: string;
  meeting_date: string;
  status: string;
  is_template?:boolean;
};

export type SongSearchResult = {
  verse_count?:number|null;first_verse?:string|null;chorus?:string|null;
  song_id: string;
  title: string;
  default_key: string | null;
  bpm: number | null;
  rank?: number;
  matched_source: string | null;
  sources?:import("@/lib/collection-colors").CollectionSource[];
  schedule?:import("@/lib/song-schedule").SongScheduleSummary;
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

export async function createMeetingAction(formData: FormData):Promise<string> {
  const {supabase}=await requireProfile("editor");
  const title=readString(formData,"title"),requestId=readString(formData,"request_id");
  if(!title||title.length>200||!/^[0-9a-f-]{36}$/i.test(requestId))throw new Error("Completează titlul și reîncearcă salvarea.");
  const {data,error}=await supabase.rpc("create_meeting_once_v49",{
    p_request_id:requestId,p_title:title,p_meeting_type:readString(formData,"meeting_type")||null,
    p_meeting_date:meetingDateISO(readString(formData,"meeting_date")),p_notes:readString(formData,"notes")||null
  });
  if(error||!data)throw new Error(error?.message||"Nu am putut crea programul.");
  revalidatePath("/meetings");return data as string;
}

export async function listMeetingsAction(): Promise<MeetingOption[]> {
  await requireProfile("read");
  const supabase = (await requireProfile("read")).supabase;
  const { data, error } = await supabase
    .from("meetings")
    .select("id,title,meeting_date,status,is_template")
    .order("meeting_date", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);
  return (data || []) as MeetingOption[];
}

export async function searchSongsAction(query:string,limit=25):Promise<SongSearchResult[]> {
 const {supabase}=await requireProfile();
 const {data,error}=await supabase.rpc('search_program_songs_v49',{p_query:query.trim().slice(0,160),p_limit:Math.min(30,Math.max(1,limit))});
 if(error)throw new Error(error.message);return (data||[]) as SongSearchResult[];
}

export async function getRecentUsageAction(daysBack = 30): Promise<Record<string, RecentUsage>> {
  await requireProfile("read");
  const supabase = (await requireProfile("read")).supabase;
  const { data, error } = await supabase.rpc("get_song_recent_usage", { days_back: daysBack });

  if (error) throw new Error(error.message);

  const map: Record<string, RecentUsage> = {};
  ((data || []) as RecentUsage[]).forEach((item) => {
    map[item.song_id] = item;
  });
  return map;
}

export async function addSongToMeetingAction(input: {
  meetingId: string;
  songId: string;
  isBackup?: boolean;
  selectedKey?: string | null;
  notes?: string | null;
  sourceId?:string|null;
}) {
  await requireProfile("editor");
  const supabase = (await requireProfile("editor")).supabase;
  const { error } = await supabase.rpc("add_program_song_v52", {
    p_meeting_id: input.meetingId,
    p_song_id: input.songId,
    p_is_backup: Boolean(input.isBackup),
    p_source_id:input.sourceId||null,
    p_selected_key: input.selectedKey || null,
    p_notes: input.notes || null
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${input.meetingId}`);
  refresh();
  return committedMeetingSnapshot(input.meetingId);
}

export async function createMeetingAndAddSongAction(input:{title:string;meetingType?:string|null;meetingDate:string;songId:string;isBackup?:boolean;requestId:string;sourceId?:string|null}) {
 const {supabase}=await requireProfile("editor");
 const {data,error}=await supabase.rpc('create_program_with_song_v57',{p_request_id:input.requestId,p_title:input.title.trim(),p_meeting_type:input.meetingType||null,p_meeting_date:meetingDateISO(input.meetingDate),p_source_id:input.sourceId||null,p_song_id:input.songId,p_is_backup:!!input.isBackup});
 if(error||!data)throw new Error(error?.message||'Nu am putut crea programul.');
 revalidatePath('/meetings');revalidatePath(`/meetings/${data}`);return data as string;
}

export async function addTextItemAction(formData: FormData) {
  await requireProfile("editor");
  const meetingId = readString(formData, "meeting_id");
  const itemType = readString(formData, "item_type") || "text";
  const title = readString(formData, "custom_title");
  const text = readString(formData, "custom_text");

  const supabase = (await requireProfile("editor")).supabase;
  const { error } = await supabase.rpc("add_moment_v57", {
    p_meeting_id: meetingId,
    p_item_type: itemType,p_color:readString(formData,"moment_color")||"#d97706",
    p_custom_title: title || null,
    p_custom_text: text || null
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
  refresh();
  return committedMeetingSnapshot(meetingId);
}



export async function updateMeetingTextItemAction(formData: FormData) {
  await requireProfile("editor");
  const meetingId = readString(formData, "meeting_id");
  const itemId = readString(formData, "item_id");
  const itemType = readString(formData, "item_type") || "text";
  const title = readString(formData, "custom_title");
  const text = readString(formData, "custom_text");

  if (!meetingId || !itemId) throw new Error("Lipsește elementul de actualizat.");

  const supabase = (await requireProfile("editor")).supabase;
  const { error } = await supabase
    .from("meeting_items")
    .update({
      item_type: itemType==="other"?"text":itemType,
      moment_kind:itemType,
      moment_color: readString(formData,"moment_color")||"#d97706",
      custom_title: title || (itemType==="other"?"Diverse":null),
      custom_text: text || null,
      notes: null, responsible_name: null
    })
    .eq("id", itemId)
    .eq("meeting_id", meetingId)
    .is("song_id", null);

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
  refresh();
  return committedMeetingSnapshot(meetingId);
}

export async function createShareLinkAction(formData: FormData) {
  await requireProfile("editor");
  const meetingId = readString(formData, "meeting_id");
  const preferredSlug = readString(formData, "preferred_slug");

  const supabase = (await requireProfile("editor")).supabase;
  const {error} = await supabase.rpc("create_meeting_share_link_v66", {
    p_meeting_id: meetingId,
    p_preferred_slug: preferredSlug || null,
    p_allow_contributions:formData.get('allow_contributions')==='on'
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
  refresh();
}

export async function removeMeetingItemAction(formData: FormData) {
  await requireProfile("editor");
  const meetingId = readString(formData, "meeting_id");
  const itemId = readString(formData, "item_id");

  const supabase = (await requireProfile("editor")).supabase;
  const { error } = await supabase.rpc("remove_meeting_item", {
    p_meeting_id: meetingId,
    p_item_id: itemId
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
  refresh();
  return committedMeetingSnapshot(meetingId);
}

export async function moveMeetingItemAction(formData: FormData) {
  await requireProfile("editor");
  const meetingId = readString(formData, "meeting_id");
  const itemId = readString(formData, "item_id");
  const direction = readString(formData, "direction") as "up" | "down";

  const supabase = (await requireProfile("editor")).supabase;
  const { error } = await supabase.rpc("move_meeting_item", {
    p_meeting_id: meetingId,
    p_item_id: itemId,
    p_direction: direction
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
  refresh();
}



export async function reorderMeetingItemsAction(input: {
  meetingId: string;
  itemIds: string[];
  isBackup: boolean;
}) {
  await requireProfile("editor");
  if (!input.meetingId) throw new Error("Lipsește programul.");
  if (!Array.isArray(input.itemIds) || input.itemIds.length === 0) return;

  const supabase = (await requireProfile("editor")).supabase;
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
  refresh();
}

export async function deleteMeetingAction(formData: FormData) {
  await requireProfile("editor");
  const meetingId = readString(formData, "meeting_id");
  const confirm = readString(formData, "confirm");

  if (!meetingId) throw new Error("Lipsește programul.");
  if (confirm !== "STERGE") throw new Error("Pentru ștergere trebuie să scrii exact: STERGE");

  const supabase = (await requireProfile("editor")).supabase;
  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", meetingId);

  if (error) throw new Error(error.message);

  revalidatePath("/songs");revalidatePath("/songs/[id]","page");
  revalidatePath("/dashboard");
  revalidatePath("/meetings");
  refresh();
  redirect("/meetings");
}

export async function deleteShareLinkAction(formData: FormData) {
  await requireProfile("editor");
  const meetingId = readString(formData, "meeting_id");
  const linkId = readString(formData, "link_id");

  if (!meetingId || !linkId) throw new Error("Lipsește linkul public.");

  const supabase = (await requireProfile("editor")).supabase;
  const { error } = await supabase
    .from("meeting_share_links")
    .delete()
    .eq("id", linkId)
    .eq("meeting_id", meetingId);

  if (error) throw new Error(error.message);

  revalidatePath(`/meetings/${meetingId}`);
  refresh();
}

export async function acceptPublicContributionAction(formData: FormData) {
  await requireProfile("editor");
  const meetingId = readString(formData, "meeting_id");
  const contributionId = readString(formData, "contribution_id");

  if (!meetingId || !contributionId) throw new Error("Lipsește propunerea.");

  const supabase = (await requireProfile("editor")).supabase;
  const { error } = await supabase.rpc("accept_public_meeting_contribution", {
    p_contribution_id: contributionId
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
  refresh();
  return committedMeetingSnapshot(meetingId);
}

export async function rejectPublicContributionAction(formData: FormData) {
  await requireProfile("editor");
  const meetingId = readString(formData, "meeting_id");
  const contributionId = readString(formData, "contribution_id");

  if (!meetingId || !contributionId) throw new Error("Lipsește propunerea.");

  const supabase = (await requireProfile("editor")).supabase;
  const { error } = await supabase.rpc("reject_public_meeting_contribution", {
    p_contribution_id: contributionId
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`);
  refresh();
}

export async function duplicateMeetingAction(input: { meetingId: string; title: string; meetingDate: string }) {
  const { supabase } = await requireProfile("editor");
  const date = new Date(meetingDateISO(input.meetingDate));
  if (!input.title.trim() || input.title.length > 200 || !Number.isFinite(date.getTime())) throw new Error("Completează un titlu și o dată validă.");
  const { data, error } = await supabase.rpc("duplicate_meeting", {
    p_meeting_id: input.meetingId, p_title: input.title.trim(), p_meeting_date: date.toISOString()
  });
  if (error || !data) throw new Error(error?.message || "Programul nu a putut fi copiat.");
  revalidatePath("/meetings"); revalidatePath("/dashboard");
  refresh();
  return String(data);
}

export async function setMeetingTemplateAction(formData: FormData) {
  const { supabase } = await requireProfile("editor");
  const id = readString(formData, "meeting_id");
  const { error } = await supabase.from("meetings").update({ is_template: formData.get("is_template") === "true" }).eq("id",id);
  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${id}`); revalidatePath("/meetings"); revalidatePath("/dashboard");
  refresh();
}

export async function updateItemResponsibleAction(formData: FormData) {
  const { supabase } = await requireProfile("editor");
  const meetingId = readString(formData,"meeting_id");
  const itemId = readString(formData,"item_id");
  const name = readString(formData,"responsible_name");
  const notes = readString(formData,"notes");
  const musicalKey=readString(formData,"selected_key");
  if(musicalKey.length>20)throw new Error("Tonalitatea poate avea maximum 20 de caractere.");
  if (notes.length > 5000) throw new Error("Observațiile pot avea maximum 5000 de caractere.");
  if (!meetingId || !itemId || name.length > 120) throw new Error("Responsabilul poate avea maximum 120 de caractere.");
  const {error}=await supabase.rpc('update_program_song_v62',{p_meeting_id:meetingId,p_item_id:itemId,p_data:{responsible_name:name,notes,selected_key:musicalKey,performance_structure:readString(formData,'performance_structure'),verse_count:readString(formData,'verse_count'),...(formData.has('selected_source_id')?{selected_source_id:readString(formData,'selected_source_id')}:{})}});
  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${meetingId}`); revalidatePath("/program", "layout");
  refresh();
  return committedMeetingSnapshot(meetingId);
}

// One browser action per search. Usage is loaded only when there are results,
// and only for those songs; opening an idle search box makes no POST request.
export async function searchSongsWithUsageAction(query: string, limit = 25, includeUsage = true) {
  const { supabase } = await requireProfile("read");
  const songs = await searchSongsAction(query, Math.min(50, Math.max(1, Math.trunc(limit) || 25)));
  if (!includeUsage || !songs.length) return { songs, recent: null };
  const { data, error } = await supabase.rpc("get_song_recent_usage", { days_back: 30 }).in("song_id", songs.map(song => song.song_id));
  if (error) throw new Error(error.message);
  const recent: Record<string, RecentUsage> = Object.fromEntries(((data || []) as RecentUsage[]).map(row => [row.song_id, row]));
  return { songs, recent };
}

export async function placeMeetingItemAction(input: { meetingId: string; itemId: string; isBackup: boolean; beforeId?: string | null }) {
  const { supabase } = await requireProfile("editor");
  const { error } = await supabase.rpc("place_meeting_item_v45", {
    p_meeting_id: input.meetingId, p_item_id: input.itemId,
    p_is_backup: input.isBackup, p_before_id: input.beforeId || null
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${input.meetingId}`);
  revalidatePath("/program", "layout");
  refresh();
  return committedMeetingSnapshot(input.meetingId);
}

export async function saveMeetingResponsiblesAction(formData: FormData) {
  const { supabase } = await requireProfile("editor");
  const id = readString(formData, "meeting_id");
  const principal = readString(formData, "principal_responsible");
  const secondary = formData.getAll("secondary_responsible").map(value => String(value).trim()).filter(Boolean);
  if (!id || principal.length > 120 || secondary.length > 20 || secondary.some(name => name.length > 120)) {
    throw new Error("Maximum 20 de responsabili secundari și 120 de caractere pentru fiecare nume.");
  }
  const { error } = await supabase.from("meetings").update({ principal_responsible: principal || null, secondary_responsibles: secondary }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/meetings/${id}`);
  revalidatePath("/program", "layout");
  refresh();
  return committedMeetingSnapshot(id);
}

async function committedMeetingSnapshot(meetingId: string): Promise<MeetingSnapshot> {
  revalidatePath('/songs');revalidatePath('/songs/[id]','page');revalidatePath('/dashboard');revalidatePath('/program','layout');
  const { supabase } = await requireProfile("editor");
  const { data, error } = await supabase.rpc("get_meeting_snapshot_v46", { p_meeting_id: meetingId });
  if (error || !data) throw new Error(error?.message || "Datele programului nu au putut fi confirmate.");
  return data as MeetingSnapshot;
}

export async function setShareContributionsAction(data:FormData){
 const {supabase}=await requireProfile('editor');const meetingId=readString(data,'meeting_id'),linkId=readString(data,'link_id');
 const {error}=await supabase.from('meeting_share_links').update({allow_contributions:data.get('allow_contributions')==='on'}).eq('id',linkId).eq('meeting_id',meetingId);
 if(error)throw new Error(error.message);revalidatePath(`/meetings/${meetingId}`);revalidatePath('/program','layout');refresh();
}

export async function setCongregationalAction(input: { meetingId: string; itemId: string; enabled: boolean }) {
  const { supabase } = await requireProfile("editor");
  if (typeof input.enabled !== "boolean") throw new Error("Marcaj invalid.");
  const { error } = await supabase.from("meeting_items").update({is_congregational: input.enabled})
    .eq("id", input.itemId).eq("meeting_id", input.meetingId).not("song_id", "is", null).select("id").single();
  if (error) throw new Error("Marcajul nu a fost salvat: " + error.message);
  revalidatePath(`/meetings/${input.meetingId}`);
  revalidatePath("/program", "layout");
  refresh();
  return committedMeetingSnapshot(input.meetingId);
}
