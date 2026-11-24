import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile, canEdit } from "@/lib/auth";
import { PlaylistEditor, type RehearsalPlaylist } from "@/features/wishlist/components/PlaylistEditor";

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  const { data, error } = await supabase.rpc("get_rehearsal_playlist_v84", { p_playlist: id });
  if (error) return <p className="error">Wishlistul nu poate fi încărcat. Verifică UPDATE-V103.sql.</p>;
  if (!data) notFound();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return (
    <>
      <div className="page-heading-v44">
        <div>
          <div className="eyebrow">Wishlist de repetiție</div>
          <h1>{data.name}</h1>
          <p>O listă de idei; nu influențează istoricul sau statisticile.</p>
        </div>
        <Link className="btn secondary" href="/playlists">
          Toate wishlisturile
        </Link>
      </div>
      <PlaylistEditor
        initial={data as RehearsalPlaylist}
        editable={canEdit(profile.role)}
        siteUrl={siteUrl}
      />
    </>
  );
}
