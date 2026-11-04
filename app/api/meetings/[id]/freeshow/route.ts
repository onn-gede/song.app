import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { buildFreeShow, safeFreeShowFileName } from "@/lib/freeshow";
import { stripRepeatedSongTitleLines } from "@/lib/songTextCleanup";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProfile();
  const [{ data: meeting }, { data: items }] = await Promise.all([
    supabase.from("meetings").select("id,title,meeting_date").eq("id", id).single(),
    supabase.from("meeting_items").select("id,position,is_backup,custom_title,custom_text,notes,songs(id,title,lyrics_text,default_key,song_sections(section_label,section_type,position,content))").eq("meeting_id", id).eq("is_backup", false).order("position"),
  ]);
  if (!meeting) return NextResponse.json({ error: "Programul nu există." }, { status: 404 });

  const slides: Array<{label:string;content:string}> = [];
  for (const item of (items || []) as any[]) {
    const song = Array.isArray(item.songs) ? item.songs[0] : item.songs;
    if (!song) {
      const content = String(item.custom_text || item.notes || "").trim();
      if (content) slides.push({label:item.custom_title || "Moment",content});
      continue;
    }
    const sections = [...(song.song_sections || [])].sort((a:any,b:any)=>Number(a.position)-Number(b.position));
    if (sections.length) sections.forEach((section:any,index:number)=>{
      const content=stripRepeatedSongTitleLines(section.content||"",song.title);
      if(content)slides.push({label:`${song.title} · ${section.section_label||section.section_type||`Strofa ${index+1}`}`,content});
    });
    else String(song.lyrics_text || "").split(/\r?\n\s*\r?\n/).filter((text) => text.trim()).forEach((content,index)=>slides.push({label:`${song.title} · Strofa ${index+1}`,content:stripRepeatedSongTitleLines(content,song.title)}));
  }
  if (!slides.length) return NextResponse.json({ error: "Programul nu conține versuri sau texte pentru export." }, { status: 422 });

  const show = buildFreeShow(meeting.title, slides, { title: meeting.title });
  const fileName = safeFreeShowFileName(`Program - ${meeting.title}`);
  return new NextResponse(JSON.stringify(show, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
