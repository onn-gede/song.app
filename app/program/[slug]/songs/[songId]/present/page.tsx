import { notFound } from "next/navigation";
import { SongPresentation } from "@/components/SongPresentation";
import { createClient } from "@/lib/supabase/server";
import { stripRepeatedSongTitleLines } from "@/lib/songTextCleanup";

type PageProps = { params: Promise<{ slug: string; songId: string }> };

export default async function PublicSongPresentationPage({ params }: PageProps) {
  const { slug, songId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_meeting_v79", { p_public_slug: slug });
  if (error || !data) notFound();

  const item = ((data as any).items || []).find((entry: any) => entry.song?.id === songId);
  if (!item?.song) notFound();

  const lyrics = stripRepeatedSongTitleLines(item.song.lyrics_text || "", item.song.title);
  const slides = lyrics.split(/\r?\n\s*\r?\n/).map((content: string, index: number) => ({
    id: `public-${songId}-${index}`,
    label: `Secțiunea ${index + 1}`,
    content: content.trim(),
    lyricsOnly: true,
  })).filter((slide: { content: string }) => slide.content.length > 0);

  return <SongPresentation songId={songId} title={item.song.title} slides={slides} fallbackLyrics={lyrics} defaultKey={item.selected_key || item.song.default_key} lyricsOnly returnHref={`/program/${slug}`}/>;
}
