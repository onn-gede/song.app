import { createHash } from "node:crypto";
import { fetchPublicPage, validatePublicUrl, type PublicPage } from "./public-page";
import { load } from "cheerio";

export type LinkSection = { section_type: string; section_label: string; position: number; content: string };
export type LinkPreview = {
  url: string; sourceKey: string; title: string; lyricsText: string; sections: LinkSection[];
  author: string; album: string; topic: string; structure: string;
};
export function normalizeSongUrl(value: string) {
  const url=validatePublicUrl(value);url.hash="";
  if(["www.resursecrestine.ro","resursecrestine.ro"].includes(url.hostname)) {
    const match=url.pathname.match(/^\/cantece\/(\d+)\/([^/]+)\/?$/);
    if(url.protocol!=="https:"||!match)throw new Error("Folosește linkul direct al unei cântări Resurse Creștine.");
    return {url:`https://www.resursecrestine.ro/cantece/${match[1]}/${match[2]}`,sourceKey:`resursecrestine:${match[1]}`};
  }
  if(url.hostname==="www.melodia.ro")url.hostname="melodia.ro";
  for(const key of [...url.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(key))url.searchParams.delete(key);
  url.searchParams.sort();
  return {url:url.href,sourceKey:`web:${createHash("sha256").update(url.href).digest("hex")}`};
}
function clean(value: string) {
  return value.replace(/\r\n?/g,"\n").replace(/[\u00a0\t]/g," ").split("\n").map(line=>line.trim().replace(/ {2,}/g," ")).join("\n").replace(/\n{3,}/g,"\n\n").trim();
}
export function sectionsFromLyrics(value: string): { sections: LinkSection[]; structure: string } {
  const sections: LinkSection[] = [];
  let structure = "";
  let lines: string[] = [];
  let type = "verse", label = "Strofa 1", verse = 0;
  const push = () => {
    const content = clean(lines.join("\n"));
    if (content) sections.push({ section_type: type, section_label: label, position: sections.length+1, content });
    lines = [];
  };
  for (const line of clean(value).split("\n")) {
    if (/^I\s*:/i.test(line)) { structure = line.replace(/^I\s*:\s*/i,""); continue; }
    const marker = line.match(/^(?:(\d+)[.)]\s*|(?:Strofa|Strofă|Vers|S|V)\s*(\d+)\s*[:.)-]?\s*|((?:Pre[- ]?refren|Prechorus|Refren|Chorus|Bridge|Final|Ending|R|B))(?:\s*\d+)?(?=\s*[:.)-]|\s*$)\s*[:.)-]?\s*)(.*)$/i);
    if (marker) {
      push();
      const token = (marker[3] || "").toLowerCase();
      type = /^(r|refren|chorus)$/.test(token) ? "chorus" : /^(b|bridge)$/.test(token) ? "bridge" : /^(final|ending)$/.test(token) ? "ending" : token.startsWith("pre") ? "prechorus" : "verse";
      if (type === "verse") { verse = Number(marker[1] || marker[2]) || verse+1; label = `Strofa ${verse}`; }
      else label = ({ chorus: "Refren", bridge: "Bridge", ending: "Final", prechorus: "Pre-refren" } as Record<string,string>)[type];
      if (marker[4]) lines.push(marker[4]);
    } else if (!line.trim()) {
      // Blank lines delimit otherwise unlabelled stanzas; do not merge them.
      if (lines.length) { push(); type="verse"; label=`Strofa ${++verse || 1}`; }
    } else lines.push(line);
  }
  push();
  return { sections, structure };
}
function parseResursePage(html: string, sourceUrl: string): LinkPreview {
  const source = normalizeSongUrl(sourceUrl);
  const $ = load(html.replace(/(<br\s*\/?\s*>)[\r\n]+/gi,"$1"));
  const titleNode = $(".title").first().clone(); titleNode.find("script,style,button,.resize-group").remove();
  const title = clean($(".title .titleContent").first().text() || $(".title h1").first().text() || $("h1").first().text() || titleNode.text());
  if (!title || title.length>300) throw new Error("Nu am putut identifica titlul cântării în pagină.");
  const meta = $(".dottedSection.clearfix").first();
  const author = clean(meta.find('a[href*="/index-autori/"]:not([href*="/album/"])').first().text());
  const album = clean(meta.find('a[href*="/album/"]').first().text());
  const topic = clean(meta.find('a[href*="/index-tematic/"]').first().text());
  // The site duplicates lyrics for carousel, portrait and normal view. Use just
  // the normal view. Never flatten a generic .clearfix or the full page.
  const body = $(".resized-text").first().clone();
  body.find("script,style,button,nav,.commentsWrapper").remove();
  body.find("br").replaceWith("\n");
  body.find("p,div").append("\n");
  let text = clean(body.text());
  if (!text) {
    const blocks = $(".cantec-fullscreen .carousel-mode .strofa").map((_,node)=>{
      const stanza=$(node);const content=stanza.find(".strofa-text").clone();content.find("br").replaceWith("\n");
      return `${stanza.find(".strofa-label").text()}\n${content.text()}`;
    }).get();
    text=clean(blocks.join("\n\n"));
  }
  if (text.length<20 || text.length>100000) throw new Error("Nu am identificat versurile. Poți folosi importul din text și verifica manual cântarea.");
  const parsed = sectionsFromLyrics(text);
  if (!parsed.sections.length) throw new Error("Cântarea nu conține secțiuni cu versuri.");
  return { ...source, title, lyricsText: parsed.sections.map(s=>`${s.section_label}\n${s.content}`).join("\n\n"), ...parsed, author, album, topic };
}

function genericSongPage(html:string,sourceUrl:string):LinkPreview {
  const source=normalizeSongUrl(sourceUrl),$=load(html.replace(/(<br\s*\/?\s*>)[\r\n]+/gi,"$1"));
  let composition:any=null;
  $("script[type='application/ld+json']").each((_,node)=>{
    try{const parsed=JSON.parse($(node).text());const queue=Array.isArray(parsed)?[...parsed]:[parsed];
      while(queue.length){const item=queue.shift();if(!item||typeof item!=="object")continue;if(item['@graph'])queue.push(...item['@graph']);if(item.lyrics && !composition)composition=item;}
    }catch{}
  });
  const heading=$("h1").first().clone();heading.find('.key-group,.subtitle,button,select,script,style').remove();
  const title=clean(composition?.name||heading.text()||$("meta[property='og:title']").attr('content')||'');
  if(!title||title.length>300)throw new Error("Nu am identificat titlul cântării.");
  const sections:LinkSection[]=[];const seen=new Set<string>();let verse=0;
  const container=$(".lyrics-container").first();
  container.children('[data-section-key]').each((_,node)=>{
    const el=$(node),key=el.attr('data-section-key')||'';if(seen.has(key))return;seen.add(key);
    const token=key.split('-')[0];const type=/chorus|refren/.test(token)?'chorus':/bridge/.test(token)?'bridge':/outro|ending|final/.test(token)?'ending':/pre/.test(token)?'prechorus':'verse';
    const part=el.clone();part.find('.chord,.section-label,script,style,button').remove();part.find('br').replaceWith('\n');
    const content=clean(part.text());if(!content)return;
    const label=type==='verse'?`Strofa ${++verse}`:({chorus:'Refren',bridge:'Bridge',ending:'Final',prechorus:'Pre-refren'} as Record<string,string>)[type];
    sections.push({section_type:type,section_label:label,position:sections.length+1,content});
  });
  if(!sections.length){
    let text='';const lyric=composition?.lyrics;
    if(typeof lyric==='string')text=lyric;else if(typeof lyric?.text==='string')text=lyric.text;
    if(text)text=text.replace(/\[key\[[^\]]+\]\]/gi,'').replace(/\[\[[^\]]+\]\]/g,'');
    if(!text){
      const selectors=['[data-lyrics-container]','[itemprop="lyrics"]','[data-lyrics]','.song-lyrics','.lyricbox','#lyrics','.lyrics'];
      for(const selector of selectors){const found=$(selector);if(!found.length)continue;
        text=found.map((_,node)=>{const el=$(node).clone();el.find('script,style,nav,button,.chord,.comments,.advertisement').remove();el.find('br').replaceWith('\n');el.find('p,section').append('\n\n');return clean(el.text());}).get().join('\n\n');if(text.trim())break;}
    }
    sections.push(...sectionsFromLyrics(text).sections);
  }
  const lyricsText=sections.map(part=>`${part.section_label}\n${part.content}`).join('\n\n');
  if(lyricsText.length<20||lyricsText.length>100000||!sections.length)throw new Error("Nu am găsit un bloc de versuri în această pagină. Site-ul poate necesita JavaScript sau poate bloca citirea. Folosește importul din text.");
  let verseIndex=0;const structure=sections.map(part=>part.section_type==='verse'?`S${++verseIndex}`:({chorus:'R',bridge:'B',ending:'F',prechorus:'PR'} as Record<string,string>)[part.section_type]||'S').join(', ');
  return {...source,title,lyricsText,sections,structure,author:typeof composition?.composer?.name==='string'?composition.composer.name:'',album:'',topic:''};
}
export function parseSongPage(html:string,sourceUrl:string):LinkPreview {
  const host=new URL(normalizeSongUrl(sourceUrl).url).hostname;
  return host==='www.resursecrestine.ro'?parseResursePage(html,sourceUrl):genericSongPage(html,sourceUrl);
}
export async function readSongUrl(value:string,deps:{readPage?:(url:string)=>Promise<PublicPage>}={}):Promise<LinkPreview> {
  let source=normalizeSongUrl(value);
  for(let step=0;step<4;step++){
    let response:PublicPage;
    try{response=await (deps.readPage||fetchPublicPage)(source.url);}catch(error){const message=error instanceof Error?error.message:"";throw new Error(/publică|prea mare|decodată/.test(message)?message:"Pagina nu poate fi citită momentan. Verifică linkul și conexiunea sau folosește importul din text.");}
    if([301,302,303,307,308].includes(response.status)){
      if(!response.location)throw new Error("Redirecționare incompletă.");
      const next=normalizeSongUrl(new URL(response.location,source.url).href);
      if(source.sourceKey.startsWith('resursecrestine:')&&next.sourceKey!==source.sourceKey)throw new Error("Linkul redirecționează către altă cântare. Folosește adresa finală.");
      source=next;continue;
    }
    if(response.status!==200)throw new Error([403,429].includes(response.status)?"Sursa nu permite citirea momentan. Folosește importul din text.":`Pagina nu este disponibilă (HTTP ${response.status}).`);
    if(!/text\/html|application\/xhtml\+xml/i.test(response.contentType))throw new Error("Linkul nu returnează o pagină HTML.");
    if(Buffer.byteLength(response.html)>2*1024*1024)throw new Error("Pagina este prea mare pentru preview.");
    return parseSongPage(response.html,source.url);
  }
  throw new Error("Prea multe redirecționări. Folosește linkul direct.");
}
