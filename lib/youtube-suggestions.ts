export type YouTubeSuggestionResult={videoId:string;title:string;channel:string;thumbnail:string|null;url:string};

export function isYouthCollection(collection:{name?:string|null;short_code?:string|null}|null|undefined){
 const value=`${collection?.name||""} ${collection?.short_code||""}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 return /(^|\W)tineri(\W|$)/.test(value);
}

export function youtubeSearchUrl(title:string){
 return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title.trim()} cântare creștină`)}`;
}

export function parseYouTubeSearchItems(value:unknown):YouTubeSuggestionResult[]{
 const items=Array.isArray((value as any)?.items)?(value as any).items:[];
 return items.flatMap((item:any)=>{
  const videoId=String(item?.id?.videoId||"").trim(),title=String(item?.snippet?.title||"").trim();
  if(!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)||!title)return [];
  return [{videoId,title,channel:String(item?.snippet?.channelTitle||""),thumbnail:item?.snippet?.thumbnails?.medium?.url||item?.snippet?.thumbnails?.default?.url||null,url:`https://www.youtube.com/watch?v=${videoId}`}];
 });
}
