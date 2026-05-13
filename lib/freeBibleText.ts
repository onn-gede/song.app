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
