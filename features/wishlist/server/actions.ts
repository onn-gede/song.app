"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import type { MoveWishlistSongInput, WishlistMutationResult } from "@/features/wishlist/types";

function formValue(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

function revalidateWishlist(playlistId: string, publicSlug?: string | null) {
  revalidatePath("/playlists");
  revalidatePath(`/playlists/${playlistId}`);
  if (publicSlug) revalidatePath(`/wishlist/${publicSlug}`);
}

function databaseError(error: { message: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

export async function createPlaylistAction(form: FormData) {
  const { supabase } = await requireProfile("editor");
  const { data, error } = await supabase.rpc("create_rehearsal_playlist_v84", {
    p_name: formValue(form, "name"),
    p_notes: formValue(form, "notes") || null,
  });
  if (error || !data) databaseError(error, "Wishlistul nu a putut fi creat.");
  revalidatePath("/playlists");
  redirect(`/playlists/${data}`);
}

export async function updatePlaylistAction(form: FormData) {
  const { supabase } = await requireProfile("editor");
  const playlistId = formValue(form, "playlist_id");
  const { error } = await supabase.rpc("update_rehearsal_playlist_v84", {
    p_playlist: playlistId,
    p_name: formValue(form, "name"),
    p_notes: formValue(form, "notes") || null,
  });
  if (error) databaseError(error, "Wishlistul nu a putut fi actualizat.");
  revalidateWishlist(playlistId);
}

export async function addPlaylistSongAction(input: { playlistId: string; songId: string; notes?: string }) {
  const { supabase } = await requireProfile("editor");
  const { data, error } = await supabase.rpc("add_rehearsal_playlist_song_v84", {
    p_playlist: input.playlistId,
    p_song: input.songId,
    p_notes: input.notes?.trim() || null,
  });
  if (error) databaseError(error, "Cântarea nu a putut fi adăugată.");
  revalidateWishlist(input.playlistId);
  return data as WishlistMutationResult;
}

export async function updatePlaylistItemAction(input: { playlistId: string; itemId: string; notes: string }) {
  const { supabase } = await requireProfile("editor");
  const { data, error } = await supabase.rpc("update_rehearsal_playlist_item_v84", {
    p_playlist: input.playlistId,
    p_item: input.itemId,
    p_notes: input.notes.trim() || null,
  });
  if (error) databaseError(error, "Elementul nu a putut fi actualizat.");
  revalidateWishlist(input.playlistId);
  return data as WishlistMutationResult;
}

export async function removePlaylistItemAction(input: { playlistId: string; itemId: string }) {
  const { supabase } = await requireProfile("editor");
  const { data, error } = await supabase.rpc("remove_rehearsal_playlist_song_v84", {
    p_playlist: input.playlistId,
    p_item: input.itemId,
  });
  if (error) databaseError(error, "Elementul nu a putut fi eliminat.");
  revalidateWishlist(input.playlistId);
  return data as WishlistMutationResult;
}

export async function movePlaylistItemAction(input: {
  playlistId: string;
  itemId: string;
  direction: "up" | "down";
}) {
  const { supabase } = await requireProfile("editor");
  const { data, error } = await supabase.rpc("move_rehearsal_playlist_song_v84", {
    p_playlist: input.playlistId,
    p_item: input.itemId,
    p_direction: input.direction,
  });
  if (error) databaseError(error, "Elementul nu a putut fi mutat.");
  revalidatePath(`/playlists/${input.playlistId}`);
  return data as WishlistMutationResult;
}

export async function moveWishlistSongToMeetingAction(input: MoveWishlistSongInput) {
  const { supabase } = await requireProfile("editor");
  const { data, error } = await supabase.rpc("move_wishlist_song_to_meeting_v100", {
    p_playlist: input.playlistId,
    p_item: input.itemId,
    p_meeting: input.meetingId,
    p_is_backup: Boolean(input.isBackup),
    p_selected_key: input.selectedKey?.trim() || null,
  });
  if (error) {
    const message = error.message.includes("move_wishlist_song_to_meeting_v100")
      ? "Rulează UPDATE-V100.sql în Supabase, apoi încearcă din nou."
      : error.message;
    throw new Error(message);
  }
  revalidateWishlist(input.playlistId);
  revalidatePath(`/meetings/${input.meetingId}`);
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  return data as WishlistMutationResult;
}

export async function setPlaylistVisibilityAction(input: { playlistId: string; isPublic: boolean }) {
  const { supabase } = await requireProfile("editor");
  const { data, error } = await supabase.rpc("set_rehearsal_playlist_visibility_v103", {
    p_playlist: input.playlistId,
    p_public: input.isPublic,
  });
  if (error) {
    const message = error.message.includes("set_rehearsal_playlist_visibility_v103")
      ? "Rulează UPDATE-V103.sql în Supabase, apoi încearcă din nou."
      : error.message;
    throw new Error(message);
  }
  const result = data as WishlistMutationResult;
  revalidateWishlist(input.playlistId, result?.public_slug);
  return result;
}

export async function reviewPlaylistSuggestionAction(input: {
  playlistId: string;
  contributionId: string;
  accept: boolean;
}) {
  const { supabase } = await requireProfile("editor");
  const { data, error } = await supabase.rpc("review_public_wishlist_contribution_v103", {
    p_playlist: input.playlistId,
    p_contribution: input.contributionId,
    p_accept: input.accept,
  });
  if (error) databaseError(error, "Propunerea nu a putut fi procesată.");
  const result = data as WishlistMutationResult;
  revalidateWishlist(input.playlistId, result?.public_slug);
  return result;
}

export async function deletePlaylistAction(form: FormData) {
  const { supabase } = await requireProfile("editor");
  const playlistId = formValue(form, "playlist_id");
  if (formValue(form, "confirm") !== "STERGE") {
    throw new Error("Scrie exact STERGE pentru confirmare.");
  }
  const { error } = await supabase.rpc("delete_rehearsal_playlist_v84", {
    p_playlist: playlistId,
  });
  if (error) databaseError(error, "Wishlistul nu a putut fi șters.");
  revalidatePath("/playlists");
  redirect("/playlists");
}
