import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSongUrl,parseSongPage,sectionsFromLyrics,readSongUrl } from "../lib/link-import/parser";
const url="https://www.resursecrestine.ro/cantece/123456/cantare-de-test";
const html=`<html><body><nav>Nu importa meniul</nav>
<div class="title"><div class="titleContent">Cântare de test</div><button>Copiază</button></div>
<div class="dottedSection clearfix">Autor: <a href="/cantece/index-autori/autor">Autor Test</a><a href="/cantece/index-autori/autor/album/test">Album Test</a><a href="/cantece/index-tematic/har">Har</a></div>
<div class="clearfix"><div class="cantec-fullscreen"><div class="carousel-mode"><div class="strofa"><div class="strofa-text">Duplicat ascuns</div></div></div><div class="scroll-mode">Alt duplicat ascuns</div></div>
<div class="resized-text">1. Prima linie de test<br />\r\nA doua linie de test<br />\r<br />\r\nR: Refren de test<br>Rămâi în versuri cuvânt întreg<br><br>2. A doua strofă de test<br>Ultima linie de test<br><br>B: Bridge de test<br>A doua linie de bridge<br><br>I: S1, R, S2, B</div></div>
<div class="commentsWrapper">Comentarii care nu trebuie importate</div></body></html>`;
test('extracts one lyric view, DOM title/metadata and structure without HTML chrome',()=>{
 const result=parseSongPage(html,url);
 assert.equal(result.title,'Cântare de test');assert.equal(result.author,'Autor Test');assert.equal(result.album,'Album Test');assert.equal(result.topic,'Har');
 assert.deepEqual(result.sections.map(s=>s.section_type),['verse','chorus','verse','bridge']);
 assert.equal(result.sections[0].content,'Prima linie de test\nA doua linie de test');
 assert.ok(result.sections[1].content.includes('Rămâi în versuri cuvânt întreg'));
 assert.equal(result.structure,'S1, R, S2, B');
 assert.ok(!/Duplicat|Comentarii|Nu importa|Copiază|I:/.test(result.lyricsText));
});
test('preview lyric output can be edited and parsed back without losing section types',()=>{
 const preview=parseSongPage(html,url);const edited=sectionsFromLyrics(preview.lyricsText);
 assert.deepEqual(edited.sections,preview.sections);
});
test('canonical public URLs retain stable source identity and reject local addresses',()=>{
 assert.equal(normalizeSongUrl('https://resursecrestine.ro/cantece/123456/cantare-de-test?utm_source=x#text').url,url);
 assert.equal(normalizeSongUrl('https://melodia.ro/cantari/Test?utm_source=x#lyrics').url,'https://melodia.ro/cantari/Test');
 for(const bad of ['http://www.resursecrestine.ro/cantece/123456/test','https://www.resursecrestine.ro/cantece/index-ultimele','https://127.0.0.1/cantece/1/x','https://user:secret@example.org/x','https://example.org:8443/x','file:///etc/passwd','https://2130706433/song','http://[::1]/song','https://host.local/song'])assert.throws(()=>normalizeSongUrl(bad));
});
test('structured fullscreen fallback is used once; generic clearfix is never treated as lyrics',()=>{
 const fallback=html.replace(/<div class="resized-text">[\s\S]*?<\/div>/,'').replace('Duplicat ascuns','Text de test suficient de lung pentru secțiune');
 const p=parseSongPage(fallback,url);assert.equal(p.sections.length,1);
 assert.throws(()=>parseSongPage('<div class="title">Titlu</div><div class="clearfix">Comentarii și texte fără conținut identificabil de cântare</div>',url));
});
test('redirects to private addresses are rejected before the next request',async()=>{
 let calls=0;await assert.rejects(()=>readSongUrl(url,{readPage:async()=>{calls++;return {status:302,location:'http://127.0.0.1/song',contentType:'',html:''};}}));assert.equal(calls,1);
});
test('403 and non-HTML responses give an actionable preview error',async()=>{
 await assert.rejects(()=>readSongUrl(url,{readPage:async()=>({status:403,contentType:'text/html',html:''})}),/nu permite citirea/);
 await assert.rejects(()=>readSongUrl(url,{readPage:async()=>({status:200,contentType:'application/json',html:'{}'})}),/HTML/);
});
test('Melodia sections omit chords and duplicate views while keeping repeated refrains in order',()=>{
 const html='<h1>Cântare exemplu<div class="subtitle">Alt titlu</div><div class="key-group">C D E F G</div></h1><div class="lyrics-container"><div class="verse" data-section-key="verse-1">Prima <div class="chord">G</div>linie de test<br>A doua linie de test</div><div class="chorus" data-section-key="chorus-1">Refren de test pentru aplicație</div><div class="verse hidden" data-section-key="verse-1">Duplicat ascuns</div><div class="chorus" data-section-key="chorus-2">Refren de test pentru aplicație</div></div><footer>Nu importa</footer>';
 const result=parseSongPage(html,'https://melodia.ro/cantari/Exemplu');
 assert.equal(result.title,'Cântare exemplu');assert.equal(result.sections.length,3);assert.equal(result.structure,'S1, R, R');assert.equal(result.sections[0].content,'Prima linie de test\nA doua linie de test');assert.ok(!/Duplicat|Nu importa|C D E/.test(result.lyricsText));
 assert.deepEqual(sectionsFromLyrics(result.lyricsText).sections,result.sections);
});
test('generic lyric containers and JSON-LD are parsed without falling back to whole page chrome',()=>{
 const a=parseSongPage('<h1>Alt exemplu</h1><nav>Meniu de evitat</nav><div class="song-lyrics">Strofa 1<br>Linie suficient de lungă pentru test<br><br>R1: Refren numerotat pentru test</div>','https://example.org/song');
 assert.deepEqual(a.sections.map(s=>s.section_type),['verse','chorus']);assert.ok(!a.lyricsText.includes('Meniu'));
 const b=parseSongPage('<script type="application/ld+json">'+JSON.stringify({'@type':'MusicComposition',name:'Titlu din date',lyrics:{text:'Strofa 1\nText de test din date structurate\n\nRefren\nRefrenul de test pentru import'}})+'</script>','https://example.org/other');assert.equal(b.title,'Titlu din date');assert.equal(b.sections.length,2);
 assert.throws(()=>parseSongPage('<h1>Nu e cântare</h1><main>Articol fără bloc de versuri sau date structurate</main>','https://example.org/article'),/bloc de versuri/);
});
test('public URL DNS validation rejects mixed records and private/mapped/reserved networks',async()=>{
 const {isPublicAddress,resolvePublicAddress}=await import('../lib/link-import/public-page.js');
 for(const ip of ['127.0.0.1','10.1.2.3','172.16.3.4','169.254.169.254','100.64.1.1','192.168.1.1','::1','::ffff:7f00:1','fe80::1','fc00::1','2001:db8::1','2001:0db8::1','2001::1','2001:0000::1','2002:7f00:1::','3fff::1','198.18.0.1'])assert.equal(isPublicAddress(ip),false,ip);
 assert.equal(isPublicAddress('1.1.1.1'),true);assert.equal(isPublicAddress('2606:4700:4700::1111'),true);
 const mixed=async()=>[{address:'1.1.1.1',family:4},{address:'127.0.0.1',family:4}];await assert.rejects(()=>resolvePublicAddress('example.org',mixed as any),/nu este publică/);
});
