import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SongPresentation } from "@/components/SongPresentation";

type PageProps = { params: Promise<{ id: string }> };

function labelForSection(section: any, index: number) {
  if (section.section_label) return section.section_label;
  const type = String(section.section_type || "").toLowerCase();
  if (type === "chorus") return "Refren";
  if (type === "bridge") return "Bridge";
  if (type === "prechorus") return "Pre-refren";
  if (type === "ending") return "Final";
  if (type === "text") return "Text";
  return `Strofa ${index + 1}`;
}

export default async function SongPresentationPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: song }, { data: sections }] = await Promise.all([
    supabase.from("songs").select("id,title,lyrics_text").eq("id", id).single(),
    supabase.from("song_sections").select("id,section_type,section_label,position,content").eq("song_id", id).order("position"),
  ]);

  if (!song) notFound();

  const slides = (sections || []).map((section: any, index: number) => ({
    id: section.id || `section-${index}`,
    label: labelForSection(section, index),
    content: section.content || "",
  }));

  return <SongPresentation songId={song.id} title={song.title} slides={slides} fallbackLyrics={song.lyrics_text} />;
}
