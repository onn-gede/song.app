"use server";
import { revalidatePath, refresh } from "next/cache";
import { requireProfile } from "@/lib/auth";
import {
  readSongUrl,
  normalizeSongUrl,
  sectionsFromLyrics,
  type LinkPreview,
  type LinkSection,
} from "@/lib/link-import/parser";
import { lyricsFromStructuredSections } from "@/lib/section-editor";
import { normalizeYouTubeUrl } from "@/lib/youtube";
import { isYouthCollection } from "@/lib/youtube-suggestions";
export type LinkMatch = { songId: string; title: string; sourceMatch: boolean };
export type LinkImportPreview = LinkPreview & { matches: LinkMatch[] };
export async function previewSongLinkAction(url: string): Promise<LinkImportPreview> {
  const { supabase } = await requireProfile("editor");
  const preview = await readSongUrl(url);
  const { data, error } = await supabase.rpc("find_link_song_matches", {
    p_source_key: preview.sourceKey,
    p_title: preview.title,
  });
  if (error)
    throw new Error(
      error.message.includes("find_link_song_matches")
        ? "Rulează UPDATE-V43.sql în baza existentă, apoi încearcă din nou."
        : error.message,
    );
  return { ...preview, matches: data || [] };
}
export async function saveSongLinkAction(input: {
  url: string;
  title: string;
  lyricsText: string;
  collectionIds: string[];
  existingSongId?: string | null;
  notes: string;
  structure: string;
  songNumber: string;
  sections?: LinkSection[];
  youtubeUrl?: string;
}) {
  const { supabase } = await requireProfile("editor");
  const source = normalizeSongUrl(input.url);
  if (
    !input.title.trim() ||
    input.title.length > 300 ||
    input.lyricsText.trim().length < 20 ||
    input.lyricsText.length > 100000
  )
    throw new Error("Verifică titlul și versurile înainte de salvare.");
  if (!Array.isArray(input.collectionIds) || !input.collectionIds.length || input.collectionIds.length > 20)
    throw new Error("Alege cel puțin o colecție, maximum 20.");
  if (input.notes.length > 5000 || input.structure.length > 500 || input.songNumber.length > 60)
    throw new Error("Câmpurile suplimentare sunt prea lungi.");
  const allowedTypes = new Set(["verse", "chorus", "bridge", "prechorus", "ending", "text"]);
  const originalSections = Array.isArray(input.sections)
    ? input.sections
        .slice(0, 500)
        .map((section, index) => ({
          section_type: allowedTypes.has(String(section.section_type))
            ? String(section.section_type)
            : "verse",
          section_label: String(section.section_label || `Strofa ${index + 1}`)
            .trim()
            .slice(0, 100),
          position: index + 1,
          content: String(section.content || "")
            .trim()
            .slice(0, 100000),
        }))
        .filter((section) => section.content)
    : [];
  const sections = originalSections.length ? originalSections : sectionsFromLyrics(input.lyricsText).sections;
  const reviewedLyrics = lyricsFromStructuredSections(sections);
  if (reviewedLyrics.length < 20 || reviewedLyrics.length > 100000)
    throw new Error("Verifică versurile și secțiunile înainte de salvare.");
  const { data, error } = await supabase.rpc("import_reviewed_song_link", {
    p_source_key: source.sourceKey,
    p_url: source.url,
    p_title: input.title.trim(),
    p_lyrics: reviewedLyrics,
    p_sections: sections,
    p_collection_ids: input.collectionIds,
    p_existing_song_id: input.existingSongId || null,
    p_notes: input.notes || null,
    p_structure: input.structure || null,
    p_song_number: input.songNumber || null,
  });
  if (error) throw new Error(error.message);
  if (input.youtubeUrl?.trim()) {
    const { data: collections } = await supabase
      .from("song_collections")
      .select("id,name,short_code")
      .in("id", input.collectionIds);
    if (!(collections || []).some(isYouthCollection))
      throw new Error("Sugestia YouTube poate fi salvată doar pentru colecția de tineri.");
    const { error: youtubeError } = await supabase
      .from("songs")
      .update({ youtube_url: normalizeYouTubeUrl(input.youtubeUrl) })
      .eq("id", data.songId);
    if (youtubeError) throw new Error(youtubeError.message);
  }
  for (const route of ["/songs", "/dashboard", "/collections", "/review"]) revalidatePath(route);
  revalidatePath(`/songs/${data.songId}`);
  refresh();
  return data as { songId: string; created: boolean; collectionsAdded: number };
}
