"use server";

import {refresh,revalidatePath} from "next/cache";
import {createPublicClient} from "@/lib/supabase/public";
import {PUBLIC_LIMITS,publicText} from "@/lib/public-contribution";

export type PublicWishlistSong={song_id:string;title:string;default_key:string|null;bpm:number|null;matched_source:string|null;lyrics_text:string|null};

export async function searchPublicWishlistSongsAction(slug:string,query:string):Promise<PublicWishlistSong[]>{
 const safeSlug=publicText(slug,PUBLIC_LIMITS.slug,"Link"),safeQuery=publicText(query,PUBLIC_LIMITS.query,"Căutare");
 if(safeQuery.length<2)return [];
 const {data,error}=await createPublicClient().rpc("search_public_wishlist_songs_v103",{p_slug:safeSlug,p_query:safeQuery,p_limit:20});
 if(error)throw new Error("Căutarea nu este disponibilă momentan.");
 return (data||[]) as PublicWishlistSong[];
}

export async function addPublicWishlistSuggestionAction(input:{slug:string;songId:string;contributorName?:string;notes?:string}){
 const slug=publicText(input.slug,PUBLIC_LIMITS.slug,"Link"),contributorName=publicText(input.contributorName,PUBLIC_LIMITS.name,"Nume"),notes=publicText(input.notes,PUBLIC_LIMITS.notes,"Notă");
 if(!/^[0-9a-f-]{36}$/i.test(input.songId))throw new Error("Cântare invalidă.");
 const {error}=await createPublicClient().rpc("add_public_wishlist_contribution_v103",{p_slug:slug,p_song:input.songId,p_contributor_name:contributorName||null,p_notes:notes||null});
 if(error)throw new Error(error.message.includes("deja")?error.message:"Propunerea nu a putut fi trimisă momentan.");
 revalidatePath(`/wishlist/${slug}`);
 refresh();
 return true;
}
