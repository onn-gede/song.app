import { requireProfile } from "@/lib/auth";
import { storageObjectTarget } from "@/lib/song-files";
export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const { fileId } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(fileId))
    return Response.json({ error: "Fișier invalid." }, { status: 400, headers });
  try {
    const { supabase } = await requireProfile();
    const { data: f } = await supabase
      .from("song_files")
      .select("file_name,storage_path,upload_complete_v58,presentation_only_v58")
      .eq("id", fileId)
      .single();
    const target = storageObjectTarget(f?.storage_path);
    if (!f || !target || (f.presentation_only_v58 && !f.upload_complete_v58))
      return Response.json(
        { error: "Fișierul original nu a fost păstrat. Folosește „Exportă PPTX” din pagina cântării." },
        { status: 404, headers },
      );
    const listed = await supabase.storage
      .from("song-files")
      .list(target.folder, { limit: 100, search: target.name });
    if (listed.error || !(listed.data || []).some((entry) => entry.name === target.name))
      return Response.json(
        {
          error: "Fișierul original nu mai există în Storage. Folosește „Exportă PPTX” din pagina cântării.",
        },
        { status: 404, headers },
      );
    const { data, error } = await supabase.storage
      .from("song-files")
      .createSignedUrl(target.path, 120, { download: f.file_name });
    if (error || !data)
      return Response.json({ error: "Descărcarea nu este disponibilă momentan." }, { status: 503, headers });
    return new Response(null, { status: 302, headers: { ...headers, Location: data.signedUrl } });
  } catch {
    return Response.json({ error: "Autentificare necesară." }, { status: 403, headers });
  }
}
