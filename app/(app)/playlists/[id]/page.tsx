import Link from "next/link";
import {notFound} from "next/navigation";
import {requireProfile,canEdit} from "@/lib/auth";
import {PlaylistEditor,type RehearsalPlaylist} from "@/components/PlaylistEditor";

export default async function PlaylistPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const {supabase,profile}=await requireProfile();const {data,error}=await supabase.rpc("get_rehearsal_playlist_v84",{p_playlist:id});if(error)return <p className="error">Playlistul nu poate fi încărcat. Verifică UPDATE-V84.sql.</p>;if(!data)notFound();return <><div className="page-heading-v44"><div><div className="eyebrow">Playlist de repetiție</div><h1>{data.name}</h1><p>O listă de idei; nu influențează istoricul sau statisticile.</p></div><Link className="btn secondary" href="/playlists">Toate playlisturile</Link></div><PlaylistEditor initial={data as RehearsalPlaylist} editable={canEdit(profile.role)}/></>}
