import {NextRequest,NextResponse} from "next/server";
import {requireProfile} from "@/lib/auth";
import {isYouthCollection,parseYouTubeSearchItems,youtubeSearchUrl} from "@/lib/youtube-suggestions";

export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request:NextRequest){
 try{
  const {supabase}=await requireProfile("editor");const q=String(request.nextUrl.searchParams.get("q")||"").trim().slice(0,200);const collectionId=request.nextUrl.searchParams.get("collectionId");const songId=request.nextUrl.searchParams.get("songId");
  if(q.length<2)return NextResponse.json({error:"Titlul este prea scurt."},{status:400});
  let allowed=false;
  if(collectionId&&UUID.test(collectionId)){const {data}=await supabase.from("song_collections").select("name,short_code").eq("id",collectionId).maybeSingle();allowed=isYouthCollection(data);}
  if(songId&&UUID.test(songId)){const {data}=await supabase.from("song_sources").select("song_collections(name,short_code)").eq("song_id",songId);allowed=(data||[]).some((row:any)=>isYouthCollection(Array.isArray(row.song_collections)?row.song_collections[0]:row.song_collections));}
  if(!allowed)return NextResponse.json({error:"Sugestiile YouTube sunt disponibile doar pentru colecția de tineri."},{status:403});
  const searchUrl=youtubeSearchUrl(q),key=String(process.env.YOUTUBE_DATA_API_KEY||"").trim();
  if(!key)return NextResponse.json({configured:false,searchUrl,results:[]});
  const params=new URLSearchParams({part:"snippet",type:"video",maxResults:"3",q:`${q} cântare creștină`,videoEmbeddable:"true",safeSearch:"moderate",relevanceLanguage:"ro",regionCode:"RO",key});
  const response=await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`,{cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!response.ok)return NextResponse.json({configured:true,searchUrl,results:[],warning:"YouTube nu a returnat sugestii momentan. Poți deschide căutarea manuală."});
  return NextResponse.json({configured:true,searchUrl,results:parseYouTubeSearchItems(await response.json())});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Sugestiile YouTube nu sunt disponibile."},{status:500});}
}
