import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireProfile } from "@/lib/auth";
import { buildFreeShow, safeFreeShowFileName } from "@/lib/freeshow";
import { buildFreeShowProgramPayload, type FreeShowProgramRow } from "@/lib/freeshow-program";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProfile();
  const [{ data: meeting, error: meetingError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("meetings").select("id,title,meeting_date").eq("id", id).single(),
    supabase.from("meeting_items").select("id,position,is_backup,custom_title,custom_text,notes,songs(id,title,lyrics_text,default_key,song_sections(section_label,section_type,position,content))").eq("meeting_id", id).or("is_backup.eq.false,is_backup.is.null").order("position"),
  ]);
  if (meetingError) {
    console.error("FreeShow meeting query failed", meetingError);
    return NextResponse.json({ error: "Programul nu a putut fi citit pentru export." }, { status: 500 });
  }
  if (itemsError) {
    console.error("FreeShow program items query failed", itemsError);
    return NextResponse.json({ error: "Elementele programului nu au putut fi citite pentru export." }, { status: 500 });
  }
  if (!meeting) return NextResponse.json({ error: "Programul nu există." }, { status: 404 });

  const rows: FreeShowProgramRow[] = [];
  for (const item of (items || []) as any[]) {
    const song = Array.isArray(item.songs) ? item.songs[0] : item.songs;
    rows.push({
      id: item.id,
      position: item.position,
      custom_title: item.custom_title,
      custom_text: item.custom_text,
      notes: item.notes,
      song: song || null,
    });
  }
  const payload = buildFreeShowProgramPayload(meeting.id, meeting.title, meeting.meeting_date, rows);
  if (!payload.items.length) {
    const songCount = rows.filter((row) => row.song).length;
    const momentCount = rows.length - songCount;
    const detail = songCount
      ? `Programul conține ${songCount} ${songCount === 1 ? "cântare" : "cântări"}, dar acestea nu au versuri salvate în SongApp. Fișierele PPT/PDF atașate nu conțin automat text exportabil.`
      : momentCount
        ? "Momentele din program nu au text sau observații pentru export."
        : "Programul nu conține elemente în lista principală.";
    return NextResponse.json({ error: detail }, { status: 422 });
  }

  if (new URL(request.url).searchParams.get("format") === "api") {
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  }

  const zip = new JSZip();
  payload.items.forEach((item, index) => {
    const order = String(index + 1).padStart(2, "0");
    const show = buildFreeShow(item.name, item.slides, { title: item.name });
    zip.file(`${order} - ${safeFreeShowFileName(item.name)}`, JSON.stringify(show, null, 2));
  });
  const archive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const fileName = safeFreeShowFileName(`Program - ${meeting.title}`).replace(/\.show$/i, ".zip");
  return new NextResponse(Buffer.from(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
