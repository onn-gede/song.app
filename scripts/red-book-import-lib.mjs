import CFB from 'cfb';
import JSZip from 'jszip';
import {load} from 'cheerio';
export const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function text(value){return load(String(value||'').replace(/<br\s*\/?>|<\/(?:p|div)>/gi,'\n')).text().replace(/\r\n?|\v/g,'\n').replace(/\u00a0/g,' ').split('\n').map(l=>l.trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim();}
export function numberedTitle(value){const m=String(value||'').match(/^\s*(\d{1,4})[\s.\-]+(.+)$/);return m?{number:String(Number(m[1])).padStart(3,'0'),title:m[2].replace(/^[\s.\-]+/,'').trim()}:null;}
export function groupCatalog(rows,category='cr'){
 const groups=[],review=[],byTitle=new Map(),byLyrics=new Map(),ids=new Set(),numbers=new Set();
 for(const row of rows){if(String(row.categoria_simbol)!==category)throw Error('API-ul a returnat o categorie diferită de '+category+'. Importul a fost oprit.');if(!/^\d+$/.test(String(row.id))||ids.has(String(row.id)))throw Error('ID sursă invalid sau repetat.');ids.add(String(row.id));const n=numberedTitle(row.denumire);if(!n)continue;if(numbers.has(n.number))throw Error('Mai multe cântări numerotate cu același număr: '+n.number);numbers.add(n.number);const group={...n,rows:[row]};groups.push(group);const k=normalize(n.title);byTitle.set(k,[...(byTitle.get(k)||[]),group]);const lyric=normalize(text(row.descriere));if(lyric)byLyrics.set(lyric,[...(byLyrics.get(lyric)||[]),group]);}
 for(const row of rows){if(numberedTitle(row.denumire))continue;const titleMatches=byTitle.get(normalize(row.denumire))||[],lyric=normalize(text(row.descriere)),lyricMatches=lyric?byLyrics.get(lyric)||[]:[];
  const matches=titleMatches.length===1?titleMatches:lyricMatches;
  if(matches.length===1)matches[0].rows.push(row);else review.push({sourceId:String(row.id),title:row.denumire,reason:'Număr/corespondent neclar; nu a fost importată automat.'});
 }
 groups.sort((a,b)=>Number(a.number)-Number(b.number));return {groups,review};
}
export function sectionsFromLyrics(value){
 const sections=[];let lines=[],type='verse',label='Strofa 1',verse=1;
 const push=()=>{const content=text(lines.join('\n'));if(content)sections.push({section_type:type,section_label:label,position:sections.length+1,content});lines=[];};
 for(const line of text(value).split('\n')){const m=line.match(/^(?:(\d+)[.)]\s*|(?:Strofa|Strofă|Vers|S|V)\s*(\d+)\s*[:.)-]?\s*|((?:Pre[- ]?refren|Prechorus|Refren|Chorus|Bridge|Final|Ending|R|B))(?=\s*[:.)-]|\s*$)\s*[:.)-]?\s*)(.*)$/i);
  if(m){push();const token=(m[3]||'').toLowerCase();type=/^(r|refren|chorus)$/.test(token)?'chorus':/^(b|bridge)$/.test(token)?'bridge':/^(final|ending)$/.test(token)?'ending':token.startsWith('pre')?'prechorus':'verse';label=type==='verse'?`Strofa ${verse=Number(m[1]||m[2])||verse+1}`:({chorus:'Refren',bridge:'Bridge',ending:'Final',prechorus:'Pre-refren'})[type];if(m[4])lines.push(m[4]);}
  else if(!line.trim()){if(lines.length){push();type='verse';label=`Strofa ${++verse||1}`;}}else lines.push(line);
 }push();return sections;
}
// Read defined PPT text atoms only, rather than scanning arbitrary binary strings.
export function pptTextAtoms(buffer){const chunks=[];
 function walk(start,end,depth){if(depth>30)throw Error('Structură PPT prea adâncă.');for(let at=start;at+8<=end;){const options=buffer.readUInt16LE(at),type=buffer.readUInt16LE(at+2),length=buffer.readUInt32LE(at+4),next=at+8+length;if(next>end||next<=at)break;
  if((options&15)===15)walk(at+8,next,depth+1);else if(type===4000)chunks.push(buffer.subarray(at+8,next).toString('utf16le'));else if(type===4008)chunks.push(new TextDecoder('windows-1250').decode(buffer.subarray(at+8,next)));at=next;
 }}walk(0,buffer.length,0);return chunks;
}
export async function lyricsFromPowerPoint(buffer,title){let chunks=[];
 if(buffer[0]===0x50&&buffer[1]===0x4b){const zip=await JSZip.loadAsync(buffer);const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));for(const name of names){const $=load(await zip.file(name).async('string'),{xmlMode:true});chunks.push($('a\\:p').map((_,el)=>$(el).find('a\\:t').map((_,t)=>$(t).text()).get().join('')).get().join('\n'));}}
 else{const doc=CFB.read(buffer,{type:'buffer'});const stream=doc.FileIndex.find(v=>v.name==='PowerPoint Document');if(!stream?.content)throw Error('Fișierul nu conține fluxul PPT așteptat.');chunks=pptTextAtoms(Buffer.from(stream.content));}
 const seen=new Set();const clean=chunks.map(text).filter(block=>{if(!block||/^\d+$/.test(block)||normalize(block)===normalize(title))return false;const key=normalize(block);if(seen.has(key))return false;seen.add(key);return true;});return clean.join('\n\n').trim();
}
export function sourceUrl(raw,file=false){const u=new URL(raw);if(u.protocol!=='https:'||!['www.cantaricrestine.ro','cantaricrestine.ro'].includes(u.hostname)||u.username||u.password||u.port&&u.port!=='443')throw Error('Adresă sursă nepermisă.');if(file&&!/^\/cantari\/cr\//i.test(decodeURIComponent(u.pathname)))throw Error('Fișierul nu aparține categoriei cr.');return u.href;}

// Only current slides and lyric text boxes. Do not flatten titles, footers, notes or old binary records.
export async function lyricsFromCurrentPptx(buffer){
 const zip=await JSZip.loadAsync(buffer),presentation=load(await zip.file('ppt/presentation.xml').async('string'),{xmlMode:true}),rels=load(await zip.file('ppt/_rels/presentation.xml.rels').async('string'),{xmlMode:true});
 const paths=new Map(rels('Relationship').map((_,e)=>[[$attr(rels,e,'Id'),$attr(rels,e,'Target')]]).get());
 function $attr($,e,key){return $(e).attr(key);}
 const names=presentation('p\\:sldId').map((_,e)=>paths.get(presentation(e).attr('r:id'))).get().map(p=>'ppt/'+p.replace(/^\.\//,''));
 const seen=new Set(),blocks=[];
 for(const name of names){if(!zip.file(name))throw Error('Slide curent lipsă.');const $=load(await zip.file(name).async('string'),{xmlMode:true});
  const shapes=$('p\\:sp').map((_,e)=>{const paragraphs=$(e).find('a\\:p').map((_,p)=>{let line='';$(p).find('a\\:t,a\\:br').each((_,t)=>{line+=t.name==='a:br'?'\n':$(t).text();});return line;}).get();return {text:text(paragraphs.join('\n')).replace(/\u00ad/g,'-'),placeholder:$(e).find('p\\:ph').attr('type')||''};}).get().filter(s=>s.text);
  const body=shapes.filter(s=>!['title','subTitle','sldNum','ftr','dt'].includes(s.placeholder)&&s.text.split('\n').length>1);
  const chosen=body.length?body:shapes.filter(s=>s.placeholder==='title'&&s.text.length>20);
  if(!chosen.length)throw Error('Nu am identificat sigur caseta cu versuri.');
  const content=chosen.map(s=>s.text).join('\n');const marker=shapes.find(s=>/^([1-9]|R|B)$/i.test(s.text))?.text;
  const key=(marker||'')+':'+normalize(content);if(seen.has(key))continue;seen.add(key);
  blocks.push((marker?(/^\d$/.test(marker)?marker+'. ':marker+': '):'')+content);
 }
 return blocks.join('\n\n');
}
