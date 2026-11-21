import Link from "next/link";
import {requireProfile,canEdit} from "@/lib/auth";
import {Icon} from "@/components/Icon";
import {createPlaylistAction} from "./actions";

type Playlist={id:string;name:string;notes:string|null;item_count:number;updated_at:string};
export default async function PlaylistsPage(){const {supabase,profile}=await requireProfile();const {data,error}=await supabase.rpc("list_rehearsal_playlists_v84");const rows=(data||[]) as Playlist[];return <div className="playlists-page"><div className="page-heading-v44"><div><div className="eyebrow">Idei pentru repetiții</div><h1>Playlisturi</h1><p>Păstrează cântările pe care vrei să le repeți, chiar dacă programul nu este încă stabilit.</p></div></div>
 {canEdit(profile.role)?<details className="card playlist-create-card" open={!rows.length}><summary><Icon name="plus" size={17}/> Playlist nou</summary><form action={createPlaylistAction} className="form-grid"><label className="label">Nume<input className="input" name="name" placeholder="Cântări pentru următoarea repetiție" required maxLength={120}/></label><label className="label">Observații (opțional)<textarea className="textarea textarea-tight" name="notes" maxLength={5000}/></label><button className="btn" type="submit">Creează playlistul</button></form></details>:null}
 {error?<p className="error">Playlisturile nu sunt disponibile. Rulează UPDATE-V84.sql.</p>:rows.length?<div className="playlist-grid">{rows.map(row=><Link className="playlist-card" href={`/playlists/${row.id}`} key={row.id}><span className="playlist-card-icon"><Icon name="list"/></span><span><strong>{row.name}</strong><small>{row.item_count} {Number(row.item_count)===1?"cântare":"cântări"}{row.notes?` · ${row.notes}`:""}</small></span><Icon name="chevron" size={18}/></Link>)}</div>:<section className="card empty-playlist"><Icon name="music" size={34}/><h2>Nicio idee nu se pierde</h2><p>Începe cu un playlist și adaugă în el cântările pentru repetițiile viitoare.</p></section>}
 </div>;}
