"use server";
import { revalidatePath, refresh } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { readSongUrl, normalizeSongUrl, sectionsFromLyrics, type LinkPreview } from "@/lib/link-import/parser";
export type LinkMatch = { songId: string; title: string; sourceMatch: boolean };
export type LinkImportPreview = LinkPreview & { matches: LinkMatch[] };
export async function previewSongLinkAction(url: string): Promise<LinkImportPreview> {
  const { supabase } = await requireProfile("editor");
  const preview = await readSongUrl(url);
  const { data, error } = await supabase.rpc("find_link_song_matches", { p_source_key: preview.sourceKey,p_title:preview.title });
  if (error) throw new Error(error.message.includes("find_link_song_matches") ? "Rulează UPDATE-V43.sql în baza existentă, apoi încearcă din nou." : error.message);
  return { ...preview,matches:data || [] };
}
export async function saveSongLinkAction(input: {
  url: string; title: string; lyricsText: string; collectionIds: string[];
  existingSongId?: string | null; notes: string; structure: string; songNumber: string;
}) {
  const { supabase } = await requireProfile("editor");
  const source = normalizeSongUrl(input.url);
  if (!input.title.trim() || input.title.length>300 || input.lyricsText.trim().length<20 || input.lyricsText.length>100000) throw new Error("Verifică titlul și versurile înainte de salvare.");
  if (!Array.isArray(input.collectionIds) || !input.collectionIds.length || input.collectionIds.length>20) throw new Error("Alege cel puțin o colecție, maximum 20.");
  if (input.notes.length>5000 || input.structure.length>500 || input.songNumber.length>60) throw new Error("Câmpurile suplimentare sunt prea lungi.");
  const { sections }=sectionsFromLyrics(input.lyricsText);
  const { data,error } = await supabase.rpc("import_reviewed_song_link",{
    p_source_key:source.sourceKey,p_url:source.url,p_title:input.title.trim(),p_lyrics:input.lyricsText.trim(),p_sections:sections,
    p_collection_ids:input.collectionIds,p_existing_song_id:input.existingSongId || null,p_notes:input.notes || null,
    p_structure:input.structure || null,p_song_number:input.songNumber || null
  });
  if(error)throw new Error(error.message);
  for(const route of ["/songs","/dashboard","/collections","/review"])revalidatePath(route);
  revalidatePath(`/songs/${data.songId}`);
  refresh();
  return data as { songId:string;created:boolean;collectionsAdded:number };
}
