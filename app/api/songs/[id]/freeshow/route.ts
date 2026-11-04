import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { buildFreeShow, safeFreeShowFileName } from "@/lib/freeshow";
import { stripRepeatedSongTitleLines } from "@/lib/songTextCleanup";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProfile();
  const [{ data: song }, { data: sections }, { data: sources }] = await Promise.all([
    supabase.from("songs").select("id,title,lyrics_text,default_key").eq("id", id).single(),
    supabase.from("song_sections").select("section_label,section_type,position,content").eq("song_id", id).order("position"),
    supabase.from("song_sources").select("song_number,song_collections(name)").eq("song_id", id).order("created_at").limit(1),
  ]);
  if (!song) return NextResponse.json({ error: "Cântarea nu există." }, { status: 404 });

  const slides = (sections || []).map((section: any, index: number) => ({
    label: section.section_label || section.section_type || `Strofa ${index + 1}`,
    content: stripRepeatedSongTitleLines(section.content || "", song.title),
  })).filter((slide) => slide.content.trim());
  if (!slides.length) String(song.lyrics_text || "").split(/\r?\n\s*\r?\n/).filter((text) => text.trim()).forEach((content, index) => slides.push({label:`Strofa ${index + 1}`,content:stripRepeatedSongTitleLines(content,song.title)}));
  if (!slides.length) return NextResponse.json({ error: "Cântarea nu are încă versuri pentru export." }, { status: 422 });

  const source = (sources || [])[0] as any;
  const show = buildFreeShow(song.title, slides, { title: song.title, number: source?.song_number || "", key: song.default_key || "" });
  const fileName = safeFreeShowFileName(song.title);
  return new NextResponse(JSON.stringify(show, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
