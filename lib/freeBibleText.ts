export type FreeBibleTextResult = {
  text: string;
  sourceUrl: string;
  version: string;
  copyrightNotes: string;
};

const ARCHIVE_SOURCE_URL = "https://archive.org/details/bibliacornilescu1921";
const SOURCE_NOTE =
  "Text local de lucru bazat pe Biblia Cornilescu 1921, sursă scanată disponibilă public la Internet Archive. Verifică textul înainte de folosire publică.";

function key(book: string, chapter: number, verseStart: number, verseEnd?: number | null) {
  return `${normalizeBookName(book)} ${chapter}:${verseStart}${verseEnd && verseEnd !== verseStart ? `-${verseEnd}` : ""}`;
}

export function normalizeBookName(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const TEXTS: Record<string, string> = {
  [key("Psalmii", 150, 6)]: "Tot ce are suflare să laude pe Domnul! Lăudați pe Domnul!",
  [key("Psalmii", 95, 1, 2)]: "Veniți să cântăm cu veselie Domnului și să strigăm de bucurie către Stânca mântuirii noastre.\nSă mergem înaintea Lui cu laude, să facem să răsune cântece în cinstea Lui!",
  [key("Ioan", 3, 16)]: "Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu, pentru ca oricine crede în El să nu piară, ci să aibă viața veșnică.",
  [key("Efeseni", 2, 8, 9)]: "Căci prin har ați fost mântuiți, prin credință. Și aceasta nu vine de la voi, ci este darul lui Dumnezeu.\nNu prin fapte, ca să nu se laude nimeni.",
  [key("1 Ioan", 1, 9)]: "Dacă ne mărturisim păcatele, El este credincios și drept ca să ne ierte păcatele și să ne curețe de orice nelegiuire.",
  [key("Romani", 5, 8)]: "Dar Dumnezeu Își arată dragostea față de noi prin faptul că, pe când eram noi încă păcătoși, Hristos a murit pentru noi.",
  [key("1 Corinteni", 15, 3, 4)]: "V-am învățat înainte de toate, așa cum am primit și eu: că Hristos a murit pentru păcatele noastre, după Scripturi;\ncă a fost îngropat și a înviat a treia zi, după Scripturi.",
  [key("Romani", 6, 4)]: "Noi deci, prin botezul în moartea Lui, am fost îngropați împreună cu El, pentru ca, după cum Hristos a înviat din morți, prin slava Tatălui, tot așa și noi să trăim o viață nouă.",
  [key("Luca", 2, 10, 11)]: "Dar îngerul le-a zis: «Nu vă temeți, căci vă aduc o veste bună, care va fi o mare bucurie pentru tot norodul: astăzi, în cetatea lui David, vi S-a născut un Mântuitor, care este Hristos, Domnul.»",
  [key("Matei", 11, 28)]: "Veniți la Mine, toți cei trudiți și împovărați, și Eu vă voi da odihnă.",
  [key("Psalmii", 46, 1)]: "Dumnezeu este adăpostul și sprijinul nostru, un ajutor care nu lipsește niciodată în nevoi.",
  [key("Isaia", 41, 10)]: "Nu te teme, căci Eu sunt cu tine; nu te uita cu îngrijorare, căci Eu sunt Dumnezeul tău; Eu te întăresc, tot Eu îți vin în ajutor. Eu te sprijin cu dreapta Mea biruitoare.",
  [key("Filipeni", 4, 6, 7)]: "Nu vă îngrijorați de nimic; ci, în orice lucru, aduceți cererile voastre la cunoștința lui Dumnezeu prin rugăciuni și cereri, cu mulțumiri.\nȘi pacea lui Dumnezeu, care întrece orice pricepere, vă va păzi inimile și gândurile în Hristos Isus.",
  [key("1 Tesaloniceni", 5, 18)]: "Mulțumiți lui Dumnezeu pentru toate lucrurile, căci aceasta este voia lui Dumnezeu, în Hristos Isus, cu privire la voi.",
  [key("Ioan", 14, 1, 3)]: "Să nu vi se tulbure inima. Aveți credință în Dumnezeu și aveți credință în Mine.\nÎn casa Tatălui Meu sunt multe locașuri. Dacă n-ar fi așa, v-aș fi spus. Eu Mă duc să vă pregătesc un loc.\nȘi după ce Mă voi duce și vă voi pregăti un loc, Mă voi întoarce și vă voi lua cu Mine, ca acolo unde sunt Eu, să fiți și voi.",
  [key("1 Tesaloniceni", 4, 16, 18)]: "Căci Însuși Domnul, cu un strigăt, cu glasul unui arhanghel și cu trâmbița lui Dumnezeu, Se va pogorî din cer, și întâi vor învia cei morți în Hristos.\nApoi, noi cei vii, care vom fi rămas, vom fi răpiți toți împreună cu ei în nori, ca să întâmpinăm pe Domnul în văzduh; și astfel vom fi totdeauna cu Domnul.\nMângâiați-vă, dar, unii pe alții cu aceste cuvinte.",
  [key("Psalmii", 23, 1, 4)]: "Domnul este Păstorul meu: nu voi duce lipsă de nimic.\nEl mă paște în pășuni verzi și mă duce la ape de odihnă;\nîmi înviorează sufletul și mă povățuiește pe cărări drepte, din pricina Numelui Său.\nChiar dacă ar fi să umblu prin valea umbrei morții, nu mă tem de niciun rău, căci Tu ești cu mine. Toiagul și nuiaua Ta mă mângâie.",
  [key("Galateni", 2, 20)]: "Am fost răstignit împreună cu Hristos, și trăiesc... dar nu mai trăiesc eu, ci Hristos trăiește în mine. Și viața pe care o trăiesc acum în trup o trăiesc în credința în Fiul lui Dumnezeu, care m-a iubit și S-a dat pe Sine Însuși pentru mine.",
  [key("2 Corinteni", 5, 17)]: "Căci, dacă este cineva în Hristos, este o făptură nouă. Cele vechi s-au dus: iată că toate lucrurile s-au făcut noi.",
  [key("Faptele Apostolilor", 1, 8)]: "Ci voi veți primi o putere, când Se va coborî Duhul Sfânt peste voi, și-Mi veți fi martori în Ierusalim, în toată Iudeea, în Samaria și până la marginile pământului.",
  [key("Ioan", 6, 35)]: "Isus le-a zis: «Eu sunt Pâinea vieții. Cine vine la Mine nu va flămânzi niciodată; și cine crede în Mine nu va înseta niciodată.»",
  [key("1 Corinteni", 11, 23, 26)]: "Căci am primit de la Domnul ce v-am învățat; și anume că Domnul Isus, în noaptea în care a fost vândut, a luat o pâine.\nȘi, după ce a mulțumit lui Dumnezeu, a frânt-o și a zis: «Luați, mâncați; acesta este trupul Meu care se frânge pentru voi; să faceți lucrul acesta spre pomenirea Mea.»\nTot astfel, după cină, a luat paharul și a zis: «Acest pahar este legământul cel nou în sângele Meu; să faceți lucrul acesta spre pomenirea Mea ori de câte ori veți bea din el.»\nPentru că, ori de câte ori mâncați din pâinea aceasta și beți din paharul acesta, vestiți moartea Domnului, până va veni El.",

  [key("Filipeni", 2, 9, 11)]: "De aceea și Dumnezeu L-a înălțat nespus de mult și I-a dat Numele care este mai presus de orice nume; pentru ca, în Numele lui Isus, să se plece orice genunchi al celor din ceruri, de pe pământ și de sub pământ, și orice limbă să mărturisească, spre slava lui Dumnezeu Tatăl, că Isus Hristos este Domnul.",
  [key("Evrei", 13, 8)]: "Isus Hristos este același ieri și azi și în veci!",
  [key("Apocalipsa", 5, 12)]: "Ei ziceau cu glas tare: «Vrednic este Mielul care a fost junghiat să primească puterea, bogăția, înțelepciunea, tăria, cinstea, slava și lauda!»",
  [key("Ioan", 8, 12)]: "Isus le-a vorbit din nou și a zis: «Eu sunt Lumina lumii; cine Mă urmează pe Mine nu va umbla în întuneric, ci va avea lumina vieții.»",
  [key("Ioan", 14, 6)]: "Isus i-a zis: «Eu sunt Calea, Adevărul și Viața. Nimeni nu vine la Tatăl decât prin Mine.»",
  [key("Plângerile lui Ieremia", 3, 22, 23)]: "Bunătățile Domnului nu s-au sfârșit, îndurările Lui nu sunt la capăt, ci se înnoiesc în fiecare dimineață. Și credincioșia Ta este atât de mare!",
  [key("Psalmii", 103, 1, 5)]: "Binecuvântează, suflete, pe Domnul și tot ce este în mine să binecuvânteze Numele Lui cel sfânt! Binecuvântează, suflete, pe Domnul și nu uita niciuna din binefacerile Lui! El îți iartă toate fărădelegile tale, El îți vindecă toate bolile tale; El îți izbăvește viața din groapă, El te încununează cu bunătate și îndurare; El îți satură de bunătăți bătrânețea și te face să întinerești iarăși ca vulturul.",
  [key("Psalmii", 121, 1, 2)]: "Îmi ridic ochii spre munți... De unde-mi va veni ajutorul? Ajutorul îmi vine de la Domnul, care a făcut cerurile și pământul.",
  [key("Romani", 8, 37, 39)]: "Totuși, în toate aceste lucruri, noi suntem mai mult decât biruitori, prin Acela care ne-a iubit. Căci sunt bine încredințat că nici moartea, nici viața, nici îngerii, nici stăpânirile, nici puterile, nici lucrurile de acum, nici cele viitoare, nici înălțimea, nici adâncimea, nicio altă făptură nu vor fi în stare să ne despartă de dragostea lui Dumnezeu care este în Isus Hristos, Domnul nostru.",
  [key("2 Timotei", 4, 7, 8)]: "M-am luptat lupta cea bună, mi-am isprăvit alergarea, am păzit credința. De acum mă așteaptă cununa neprihănirii, pe care mi-o va da, în ziua aceea, Domnul, Judecătorul cel drept.",
  [key("1 Petru", 1, 18, 19)]: "Căci știți că nu cu lucruri pieritoare, cu argint sau cu aur, ați fost răscumpărați din felul deșert de viețuire pe care-l moșteniserăți de la părinții voștri, ci cu sângele scump al lui Hristos, Mielul fără cusur și fără prihană.",
  [key("Coloseni", 3, 16)]: "Cuvântul lui Hristos să locuiască din belșug în voi în toată înțelepciunea. Învățați-vă și sfătuiți-vă unii pe alții cu psalmi, cu cântări de laudă și cu cântări duhovnicești, cântând lui Dumnezeu cu mulțumire în inima voastră.",
  [key("Apocalipsa", 21, 3, 4)]: "Și am auzit un glas tare care ieșea din scaunul de domnie și zicea: «Iată cortul lui Dumnezeu cu oamenii! El va locui cu ei și ei vor fi poporul Lui, și Dumnezeu Însuși va fi cu ei. El va fi Dumnezeul lor. El va șterge orice lacrimă din ochii lor. Și moartea nu va mai fi. Nu va mai fi nici tânguire, nici țipăt, nici durere, pentru că lucrurile dintâi au trecut.»",
  [key("Psalmii", 27, 1)]: "Domnul este lumina și mântuirea mea: de cine să mă tem? Domnul este sprijinitorul vieții mele: de cine să-mi fie frică?",
  [key("Psalmii", 34, 18)]: "Domnul este aproape de cei cu inima înfrântă și mântuiește pe cei cu duhul zdrobit.",
  [key("Psalmii", 40, 1, 3)]: "Îmi pusesem nădejdea în Domnul, și El S-a plecat spre mine, mi-a ascultat strigătele. M-a scos din groapa pieirii, din fundul mocirlei; mi-a pus picioarele pe stâncă și mi-a întărit pașii. Mi-a pus în gură o cântare nouă, o laudă pentru Dumnezeul nostru.",
  [key("Psalmii", 51, 10)]: "Zidește în mine o inimă curată, Dumnezeule, pune în mine un duh nou și statornic!",
  [key("Psalmii", 73, 25, 26)]: "Pe cine altul am eu în cer afară de Tine? Și pe pământ nu-mi găsesc plăcerea în nimeni decât în Tine. Carnea și inima pot să mi se prăpădească: fiindcă Dumnezeu va fi pururea stânca inimii mele și partea mea de moștenire.",
  [key("Psalmii", 100, 4, 5)]: "Intrați cu laude pe porțile Lui, intrați cu cântări în curțile Lui! Lăudați-L și binecuvântați-I Numele. Căci Domnul este bun; bunătatea Lui ține în veci și credincioșia Lui, din neam în neam.",
  [key("Psalmii", 118, 24)]: "Aceasta este ziua pe care a făcut-o Domnul: să ne bucurăm și să ne înveselim în ea!",
  [key("Isaia", 53, 5)]: "Dar El era străpuns pentru păcatele noastre, zdrobit pentru fărădelegile noastre. Pedeapsa care ne dă pacea a căzut peste El, și prin rănile Lui suntem tămăduiți.",
  [key("Isaia", 43, 1)]: "Acum, așa vorbește Domnul, care te-a făcut: «Nu te teme de nimic, căci Eu te izbăvesc, te chem pe nume: ești al Meu.»",
  [key("Ioan", 10, 11)]: "Eu sunt Păstorul cel bun. Păstorul cel bun Își dă viața pentru oi.",
  [key("Ioan", 11, 25)]: "Isus i-a zis: «Eu sunt Învierea și Viața. Cine crede în Mine, chiar dacă ar fi murit, va trăi.»",
  [key("Ioan", 15, 5)]: "Eu sunt Vița, voi sunteți mlădițele. Cine rămâne în Mine și în cine rămân Eu aduce mult rod; căci despărțiți de Mine nu puteți face nimic.",
  [key("Romani", 10, 9)]: "Dacă mărturisești deci cu gura ta pe Isus ca Domn și dacă crezi în inima ta că Dumnezeu L-a înviat din morți, vei fi mântuit.",
  [key("2 Corinteni", 12, 9)]: "Și El mi-a zis: «Harul Meu îți este de ajuns; căci puterea Mea în slăbiciune este făcută desăvârșită.» Deci mă voi lăuda mult mai bucuros cu slăbiciunile mele, pentru ca puterea lui Hristos să rămână în mine.",
  [key("Evrei", 4, 16)]: "Să ne apropiem, dar, cu deplină încredere de scaunul harului, ca să căpătăm îndurare și să găsim har, pentru ca să fim ajutați la vreme de nevoie.",
  [key("Evrei", 12, 2)]: "Să ne uităm țintă la Căpetenia și Desăvârșirea credinței noastre, adică la Isus, care, pentru bucuria care-I era pusă înainte, a suferit crucea, a disprețuit rușinea și șade la dreapta scaunului de domnie al lui Dumnezeu.",
  [key("Apocalipsa", 22, 20)]: "Cel ce adeverește aceste lucruri zice: «Da, Eu vin curând.» Amin! Vino, Doamne Isuse!",
};

export function buildStableBibleSourceUrl(book: string, chapter: number, verseStart: number, verseEnd?: number | null) {
  const range = verseEnd && verseEnd !== verseStart ? `${verseStart}-${verseEnd}` : `${verseStart}`;
  return `${ARCHIVE_SOURCE_URL}?query=${encodeURIComponent(`${book} ${chapter}:${range}`)}`;
}

export function getLocalFreeBibleText(book: string, chapter: number, verseStart: number, verseEnd?: number | null): FreeBibleTextResult | null {
  const text = TEXTS[key(book, chapter, verseStart, verseEnd)];
  if (!text) return null;
  return {
    text,
    sourceUrl: buildStableBibleSourceUrl(book, chapter, verseStart, verseEnd),
    version: "Cornilescu 1921 local fallback",
    copyrightNotes: SOURCE_NOTE,
  };
}
