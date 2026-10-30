import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { buildProgramSlides, type PresentationItem } from "@/lib/presentation";
import { SongPresentation } from "@/components/SongPresentation";
export default async function ProgramPresentation({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ backup?: string }>;
}) {
  const [{ id }, query, { supabase }] = await Promise.all([params, searchParams, requireProfile()]);
  const [{ data: meeting, error: meetingError }, { data: items, error }] = await Promise.all([
    supabase.from("meetings").select("id,title").eq("id",id).maybeSingle(),
    supabase.from("meeting_items").select("id,position,is_backup,item_type,moment_kind,performance_structure,custom_title,custom_text,selected_key,songs(title,default_key,lyrics_text,structure,verse_count_override,song_sections(id,position,section_label,section_type,content))").eq("meeting_id",id).order("position")
  ]);
  if (error || meetingError) throw new Error("Programul nu poate fi încărcat momentan.");
  if (!meeting) notFound();
  return <SongPresentation songId={id} title={meeting.title} slides={buildProgramSlides((items || []) as unknown as PresentationItem[], query.backup === "1")} live returnHref={`/meetings/${id}`} />;
}
