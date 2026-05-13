export type BibleVerseSuggestion = {
  id: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number | null;
  referenceLabel: string;
  theme: string;
  reason: string;
  confidence: number;
  matchedKeywords: string[];
};

type SuggestionTemplate = Omit<
  BibleVerseSuggestion,
  "id" | "confidence" | "matchedKeywords"
> & {
  keywords: string[];
  baseScore?: number;
};

const templates: SuggestionTemplate[] = [
  {
    book: "Psalmii",
    chapter: 150,
    verseStart: 6,
    verseEnd: null,
    referenceLabel: "Psalmii 150:6",
    theme: "laudă și închinare",
    reason:
      "Se potrivește cântărilor care cheamă întreaga creație să Îl laude pe Dumnezeu.",
    keywords: [
      "lauda",
      "laudati",
      "slava",
      "slavim",
      "inchinare",
      "adorare",
      "aleluia",
      "osana",
      "glorie",
    ],
    baseScore: 0.82,
  },
  {
    book: "Psalmii",
    chapter: 95,
    verseStart: 1,
    verseEnd: 2,
    referenceLabel: "Psalmii 95:1-2",
    theme: "închinare cu bucurie",
    reason:
      "Este potrivit când cântarea are ton de chemare la cântare, mulțumire și bucurie înaintea Domnului.",
    keywords: [
      "cantati",
      "cantare",
      "bucurie",
      "multumire",
      "lauda",
      "veselie",
    ],
    baseScore: 0.79,
  },
  {
    book: "Ioan",
    chapter: 3,
    verseStart: 16,
    verseEnd: null,
    referenceLabel: "Ioan 3:16",
    theme: "mântuire și dragostea lui Dumnezeu",
    reason:
      "Se potrivește cântărilor despre dragostea lui Dumnezeu, darul Fiului și mântuirea prin credință.",
    keywords: [
      "mantuire",
      "mantuit",
      "dragoste",
      "iubire",
      "fiul",
      "isus",
      "hristos",
      "lumea",
      "credinta",
    ],
    baseScore: 0.84,
  },
  {
    book: "Efeseni",
    chapter: 2,
    verseStart: 8,
    verseEnd: 9,
    referenceLabel: "Efeseni 2:8-9",
    theme: "har și mântuire",
    reason:
      "Este potrivit pentru cântările care subliniază harul, credința și faptul că mântuirea este darul lui Dumnezeu.",
    keywords: [
      "har",
      "mila",
      "iertare",
      "mantuire",
      "credinta",
      "dar",
      "salvat",
      "salvare",
    ],
    baseScore: 0.83,
  },
  {
    book: "1 Ioan",
    chapter: 1,
    verseStart: 9,
    verseEnd: null,
    referenceLabel: "1 Ioan 1:9",
    theme: "pocăință și iertare",
    reason:
      "Se potrivește cântărilor despre mărturisire, iertare, curățire și întoarcere la Dumnezeu.",
    keywords: [
      "pocainta",
      "pacat",
      "pacate",
      "iertare",
      "curatire",
      "spalare",
      "sange",
      "marturisire",
    ],
    baseScore: 0.81,
  },
  {
    book: "Romani",
    chapter: 5,
    verseStart: 8,
    verseEnd: null,
    referenceLabel: "Romani 5:8",
    theme: "dragostea arătată la cruce",
    reason:
      "Este potrivit pentru cântările despre cruce, jertfa Domnului Isus și dragostea lui Dumnezeu pentru păcătoși.",
    keywords: [
      "cruce",
      "jertfa",
      "sange",
      "rastignit",
      "pacatos",
      "dragoste",
      "iubire",
      "murit",
    ],
    baseScore: 0.86,
  },
  {
    book: "1 Corinteni",
    chapter: 15,
    verseStart: 3,
    verseEnd: 4,
    referenceLabel: "1 Corinteni 15:3-4",
    theme: "moartea și învierea Domnului Isus",
    reason:
      "Se potrivește cântărilor despre Evanghelie, moartea pentru păcate și învierea Domnului.",
    keywords: [
      "inviat",
      "inviere",
      "mort",
      "moarte",
      "mormant",
      "traieste",
      "hristos",
      "cristos",
      "evanghelie",
    ],
    baseScore: 0.9,
  },
  {
    book: "Romani",
    chapter: 6,
    verseStart: 4,
    verseEnd: null,
    referenceLabel: "Romani 6:4",
    theme: "botez și viață nouă",
    reason:
      "Este potrivit pentru cântări de botez sau cântări despre viața nouă în Hristos.",
    keywords: [
      "botez",
      "botezat",
      "apa",
      "viata noua",
      "innoire",
      "ingropati",
      "inviat",
    ],
    baseScore: 0.86,
  },
  {
    book: "Luca",
    chapter: 2,
    verseStart: 10,
    verseEnd: 11,
    referenceLabel: "Luca 2:10-11",
    theme: "nașterea Domnului",
    reason:
      "Se potrivește colindelor și cântărilor despre nașterea Mântuitorului.",
    keywords: [
      "nastere",
      "betleem",
      "prunc",
      "iesle",
      "pastori",
      "ingeri",
      "craciun",
      "mantuitor",
    ],
    baseScore: 0.88,
  },
  {
    book: "Matei",
    chapter: 11,
    verseStart: 28,
    verseEnd: null,
    referenceLabel: "Matei 11:28",
    theme: "chemare și odihnă în Hristos",
    reason:
      "Se potrivește cântărilor de chemare, mângâiere, oboseală sufletească și întoarcere la Domnul.",
    keywords: [
      "veniti",
      "chemare",
      "odihna",
      "povara",
      "trudit",
      "obosit",
      "mangaiere",
      "vino",
    ],
    baseScore: 0.84,
  },
  {
    book: "Psalmii",
    chapter: 46,
    verseStart: 1,
    verseEnd: null,
    referenceLabel: "Psalmii 46:1",
    theme: "încredere în încercări",
    reason:
      "Este potrivit pentru cântări despre ajutorul lui Dumnezeu în furtuni, necazuri și perioade grele.",
    keywords: [
      "furtuni",
      "necaz",
      "incercare",
      "ajutor",
      "adapost",
      "teama",
      "frica",
      "valuri",
      "greu",
    ],
    baseScore: 0.87,
  },
  {
    book: "Isaia",
    chapter: 41,
    verseStart: 10,
    verseEnd: null,
    referenceLabel: "Isaia 41:10",
    theme: "curaj și sprijin divin",
    reason:
      "Se potrivește cântărilor despre frică, slăbiciune și puterea lui Dumnezeu care susține.",
    keywords: [
      "frica",
      "teme",
      "putere",
      "sprijin",
      "ajutor",
      "mana",
      "intareste",
      "incurajare",
    ],
    baseScore: 0.84,
  },
  {
    book: "Filipeni",
    chapter: 4,
    verseStart: 6,
    verseEnd: 7,
    referenceLabel: "Filipeni 4:6-7",
    theme: "rugăciune și pace",
    reason:
      "Este potrivit pentru cântările despre rugăciune, pacea lui Dumnezeu și încredere în purtarea Lui de grijă.",
    keywords: [
      "rugaciune",
      "pace",
      "ingrijorare",
      "cereri",
      "multumiri",
      "inima",
      "ganduri",
    ],
    baseScore: 0.85,
  },
  {
    book: "1 Tesaloniceni",
    chapter: 5,
    verseStart: 18,
    verseEnd: null,
    referenceLabel: "1 Tesaloniceni 5:18",
    theme: "mulțumire",
    reason:
      "Se potrivește cântărilor de mulțumire și recunoștință față de Dumnezeu.",
    keywords: [
      "multumire",
      "multumesc",
      "recunostinta",
      "binecuvantari",
      "daruri",
      "bunatate",
    ],
    baseScore: 0.84,
  },
  {
    book: "Ioan",
    chapter: 14,
    verseStart: 1,
    verseEnd: 3,
    referenceLabel: "Ioan 14:1-3",
    theme: "nădejde și cer",
    reason:
      "Se potrivește cântărilor despre cer, nădejdea veșnică, pregătirea locului și revenirea Domnului.",
    keywords: [
      "cer",
      "nadejde",
      "vesnic",
      "acasa",
      "locas",
      "revenire",
      "vine",
      "vesnicie",
    ],
    baseScore: 0.83,
  },
  {
    book: "1 Tesaloniceni",
    chapter: 4,
    verseStart: 16,
    verseEnd: 18,
    referenceLabel: "1 Tesaloniceni 4:16-18",
    theme: "revenirea Domnului și mângâiere",
    reason:
      "Este potrivit pentru cântările despre revenirea Domnului, învierea celor credincioși și mângâierea creștină.",
    keywords: [
      "revenire",
      "vine",
      "trambita",
      "rapire",
      "inviere",
      "mangaiere",
      "adormiti",
    ],
    baseScore: 0.86,
  },
  {
    book: "Psalmii",
    chapter: 23,
    verseStart: 1,
    verseEnd: 4,
    referenceLabel: "Psalmii 23:1-4",
    theme: "păstorire și mângâiere",
    reason:
      "Se potrivește cântărilor despre Domnul ca Păstor, călăuzire, grijă și mângâiere în valea umbrei morții.",
    keywords: [
      "pastor",
      "calauzire",
      "mangaiere",
      "vale",
      "moarte",
      "toiag",
      "odihna",
      "ape",
    ],
    baseScore: 0.85,
  },
  {
    book: "Galateni",
    chapter: 2,
    verseStart: 20,
    verseEnd: null,
    referenceLabel: "Galateni 2:20",
    theme: "viață trăită prin Hristos",
    reason:
      "Este potrivit pentru cântările despre predare, trăire pentru Hristos și identitate în El.",
    keywords: [
      "traiesc",
      "hristos",
      "predare",
      "viata",
      "eu",
      "credinta",
      "rastignit",
    ],
    baseScore: 0.82,
  },
  {
    book: "2 Corinteni",
    chapter: 5,
    verseStart: 17,
    verseEnd: null,
    referenceLabel: "2 Corinteni 5:17",
    theme: "făptură nouă",
    reason:
      "Se potrivește cântărilor despre schimbarea vieții, naștere din nou și înnoire.",
    keywords: [
      "nou",
      "noua",
      "schimbare",
      "nascut",
      "innoire",
      "viata",
      "faptura",
    ],
    baseScore: 0.82,
  },
  {
    book: "Faptele Apostolilor",
    chapter: 1,
    verseStart: 8,
    verseEnd: null,
    referenceLabel: "Faptele Apostolilor 1:8",
    theme: "mărturie și Duhul Sfânt",
    reason:
      "Este potrivit pentru cântările despre mărturie, misiune și puterea Duhului Sfânt.",
    keywords: [
      "duh",
      "sfant",
      "marturie",
      "misiune",
      "putere",
      "vesti",
      "evanghelie",
    ],
    baseScore: 0.83,
  },
  {
    book: "Ioan",
    chapter: 6,
    verseStart: 35,
    verseEnd: null,
    referenceLabel: "Ioan 6:35",
    theme: "Hristos, Pâinea vieții",
    reason:
      "Se potrivește cântărilor pentru Cina Domnului sau cântărilor despre Hristos ca hrană spirituală.",
    keywords: ["cina", "paine", "trup", "hrana", "viata", "foame", "isus"],
    baseScore: 0.84,
  },
  {
    book: "1 Corinteni",
    chapter: 11,
    verseStart: 23,
    verseEnd: 26,
    referenceLabel: "1 Corinteni 11:23-26",
    theme: "Cina Domnului și jertfa Domnului",
    reason:
      "Este potrivit pentru cântări folosite la Cina Domnului, amintirea morții Domnului și vestirea revenirii Lui.",
    keywords: [
      "cina",
      "paine",
      "pahar",
      "sange",
      "trup",
      "moarte",
      "jertfa",
      "amintire",
    ],
    baseScore: 0.9,
  },

  {
    book: "Filipeni",
    chapter: 2,
    verseStart: 9,
    verseEnd: 11,
    referenceLabel: "Filipeni 2:9-11",
    theme: "Domnia și înălțarea lui Hristos",
    reason:
      "Se potrivește cântărilor care afirmă că Isus Hristos este Domnul, vrednic de închinare și înălțat peste toate.",
    keywords: [
      "isus hristos e domnul",
      "isus hristos este domnul",
      "hristos e domnul",
      "domnul isus",
      "domn",
      "nume",
      "inaltat",
      "vrednic",
      "imparat",
      "domnie",
      "genunchi",
    ],
    baseScore: 0.92,
  },
  {
    book: "Evrei",
    chapter: 13,
    verseStart: 8,
    verseEnd: null,
    referenceLabel: "Evrei 13:8",
    theme: "Hristos neschimbat",
    reason:
      "Este potrivit pentru cântări despre credincioșia și neschimbarea Domnului Isus de-a lungul vremurilor.",
    keywords: [
      "neschimbat",
      "acelasi",
      "ieri",
      "azi",
      "vesnic",
      "ramane",
      "credincios",
      "statornic",
    ],
    baseScore: 0.86,
  },
  {
    book: "Apocalipsa",
    chapter: 5,
    verseStart: 12,
    verseEnd: null,
    referenceLabel: "Apocalipsa 5:12",
    theme: "Mielul este vrednic",
    reason:
      "Se potrivește cântărilor care Îl proclamă pe Mielul jertfit ca vrednic de laudă, cinste și slavă.",
    keywords: [
      "miel",
      "vrednic",
      "jertfit",
      "lauda",
      "cinste",
      "slava",
      "putere",
      "mielul",
    ],
    baseScore: 0.9,
  },
  {
    book: "Ioan",
    chapter: 8,
    verseStart: 12,
    verseEnd: null,
    referenceLabel: "Ioan 8:12",
    theme: "Hristos, lumina lumii",
    reason:
      "Este potrivit pentru cântări despre lumină, călăuzire și ieșirea din întuneric prin Hristos.",
    keywords: [
      "lumina",
      "intuneric",
      "calauzeste",
      "calea",
      "straluceste",
      "soare",
      "rază",
      "raza",
    ],
    baseScore: 0.86,
  },
  {
    book: "Ioan",
    chapter: 14,
    verseStart: 6,
    verseEnd: null,
    referenceLabel: "Ioan 14:6",
    theme: "Hristos, calea, adevărul și viața",
    reason:
      "Se potrivește cântărilor care vorbesc despre cale, adevăr, viață și apropierea de Tatăl prin Domnul Isus.",
    keywords: [
      "cale",
      "calea",
      "adevar",
      "viata",
      "tatal",
      "drum",
      "urmez",
      "urmare",
    ],
    baseScore: 0.86,
  },
  {
    book: "Plângerile lui Ieremia",
    chapter: 3,
    verseStart: 22,
    verseEnd: 23,
    referenceLabel: "Plângerile lui Ieremia 3:22-23",
    theme: "bunătatea și credincioșia Domnului",
    reason:
      "Este potrivit pentru cântări despre îndurare, bunătate, credincioșie și har în fiecare zi.",
    keywords: [
      "bunatate",
      "indurare",
      "mila",
      "credinciosie",
      "dimineata",
      "har",
      "bun",
      "mari sunt",
    ],
    baseScore: 0.88,
  },
  {
    book: "Psalmii",
    chapter: 103,
    verseStart: 1,
    verseEnd: 5,
    referenceLabel: "Psalmii 103:1-5",
    theme: "binecuvântare, iertare și vindecare",
    reason:
      "Se potrivește cântărilor care cheamă sufletul la binecuvântarea Domnului și amintesc iertarea și îndurările Lui.",
    keywords: [
      "binecuvanteaza",
      "suflete",
      "iertare",
      "vindecare",
      "indurari",
      "bunatati",
      "lauda suflete",
    ],
    baseScore: 0.88,
  },
  {
    book: "Psalmii",
    chapter: 121,
    verseStart: 1,
    verseEnd: 2,
    referenceLabel: "Psalmii 121:1-2",
    theme: "ajutorul vine de la Domnul",
    reason:
      "Este potrivit pentru cântări despre ridicarea privirii spre Dumnezeu, ajutor, pază și sprijin în călătorie.",
    keywords: [
      "ajutor",
      "munti",
      "privirea",
      "paza",
      "pazeste",
      "calatorie",
      "drum",
      "sprijin",
    ],
    baseScore: 0.86,
  },
  {
    book: "Romani",
    chapter: 8,
    verseStart: 37,
    verseEnd: 39,
    referenceLabel: "Romani 8:37-39",
    theme: "biruință și dragostea lui Hristos",
    reason:
      "Se potrivește cântărilor despre biruință, despărțire de frică și siguranța dragostei lui Hristos.",
    keywords: [
      "biruinta",
      "biruitor",
      "invingator",
      "desparti",
      "dragostea lui hristos",
      "nimic",
      "frica",
      "lupta",
    ],
    baseScore: 0.88,
  },
  {
    book: "2 Timotei",
    chapter: 4,
    verseStart: 7,
    verseEnd: 8,
    referenceLabel: "2 Timotei 4:7-8",
    theme: "alergarea credinței până la capăt",
    reason:
      "Este potrivit pentru cântări despre alergare, luptă, credincioșie și nădejdea cununii.",
    keywords: [
      "alergare",
      "lupta",
      "credinta",
      "cunună",
      "cununa",
      "sfarsit",
      "pana la capat",
      "biruit",
    ],
    baseScore: 0.84,
  },
  {
    book: "1 Petru",
    chapter: 1,
    verseStart: 18,
    verseEnd: 19,
    referenceLabel: "1 Petru 1:18-19",
    theme: "răscumpărare prin sângele lui Hristos",
    reason:
      "Se potrivește cântărilor despre răscumpărare, sângele Domnului Isus și prețul jertfei Sale.",
    keywords: [
      "rascumparat",
      "rascumparare",
      "sange",
      "pret",
      "miel",
      "jertfa",
      "iertat",
      "curatit",
    ],
    baseScore: 0.9,
  },
  {
    book: "Coloseni",
    chapter: 3,
    verseStart: 16,
    verseEnd: null,
    referenceLabel: "Coloseni 3:16",
    theme: "cântare, învățătură și mulțumire",
    reason:
      "Este potrivit pentru cântări despre cântarea bisericii, lauda din inimă și mulțumirea adusă Domnului.",
    keywords: [
      "cantare",
      "cantari",
      "psalmi",
      "laude",
      "duhovnicesti",
      "inima",
      "multumire",
      "har",
    ],
    baseScore: 0.82,
  },
  {
    book: "Apocalipsa",
    chapter: 21,
    verseStart: 3,
    verseEnd: 4,
    referenceLabel: "Apocalipsa 21:3-4",
    theme: "cer nou și mângâiere veșnică",
    reason:
      "Se potrivește cântărilor despre cer, lacrimi șterse, veșnicie și nădejdea finală.",
    keywords: [
      "cer",
      "lacrimi",
      "durere",
      "moarte",
      "vesnicie",
      "acasa",
      "nou",
      "mangaiere",
    ],
    baseScore: 0.87,
  },
  {
    book: "Psalmii",
    chapter: 27,
    verseStart: 1,
    verseEnd: null,
    referenceLabel: "Psalmii 27:1",
    theme: "Domnul este lumină și mântuire",
    reason: "Se potrivește cântărilor despre lumină, mântuire, curaj și siguranță în Domnul.",
    keywords: ["lumina", "intuneric", "mantuirea", "frica", "curaj", "sprijinitor", "teama"],
    baseScore: 0.86,
  },
  {
    book: "Psalmii",
    chapter: 34,
    verseStart: 18,
    verseEnd: null,
    referenceLabel: "Psalmii 34:18",
    theme: "Domnul aproape de cei zdrobiți",
    reason: "Se potrivește cântărilor despre mângâiere, lacrimi, inimă frântă și apropierea Domnului în durere.",
    keywords: ["lacrimi", "plans", "plang", "durere", "zdrobit", "inima franta", "aproape", "mangaiere", "suflet ranit"],
    baseScore: 0.86,
  },
  {
    book: "Psalmii",
    chapter: 40,
    verseStart: 1,
    verseEnd: 3,
    referenceLabel: "Psalmii 40:1-3",
    theme: "cântare nouă după izbăvire",
    reason: "Se potrivește cântărilor despre izbăvire, ridicare din groapă și cântare nouă pusă de Dumnezeu în inimă.",
    keywords: ["cantare noua", "izbavire", "groapa", "mocirla", "stanca", "ridicat", "strigat", "nadejde"],
    baseScore: 0.88,
  },
  {
    book: "Psalmii",
    chapter: 51,
    verseStart: 10,
    verseEnd: null,
    referenceLabel: "Psalmii 51:10",
    theme: "inimă curată și reînnoire",
    reason: "Se potrivește cântărilor de pocăință, curățire, predare și dorință de înnoire spirituală.",
    keywords: ["inima curata", "curat", "zideste", "duh nou", "pocainta", "schimba", "renoire", "predare"],
    baseScore: 0.87,
  },
  {
    book: "Psalmii",
    chapter: 73,
    verseStart: 25,
    verseEnd: 26,
    referenceLabel: "Psalmii 73:25-26",
    theme: "Dumnezeu este partea inimii",
    reason: "Se potrivește cântărilor despre dorul după Dumnezeu, dependență de El și comoara sufletului.",
    keywords: ["doar tu", "numai tu", "inima mea", "partea mea", "dor", "cer", "pamant", "stanca inimii"],
    baseScore: 0.86,
  },
  {
    book: "Psalmii",
    chapter: 100,
    verseStart: 4,
    verseEnd: 5,
    referenceLabel: "Psalmii 100:4-5",
    theme: "mulțumire și bunătatea Domnului",
    reason: "Se potrivește cântărilor de mulțumire, intrare înaintea Domnului cu laude și recunoașterea bunătății Lui.",
    keywords: ["multumire", "multumesc", "bunatate", "bun", "credinciosie", "porti", "curtile", "binecuvantati"],
    baseScore: 0.86,
  },
  {
    book: "Psalmii",
    chapter: 118,
    verseStart: 24,
    verseEnd: null,
    referenceLabel: "Psalmii 118:24",
    theme: "bucurie în ziua Domnului",
    reason: "Se potrivește cântărilor despre ziua Domnului, bucurie, sărbătoare și veselie în prezența Lui.",
    keywords: ["ziua", "bucuram", "bucurie", "veselie", "sarbatoare", "astazi", "zi"],
    baseScore: 0.82,
  },
  {
    book: "Isaia",
    chapter: 53,
    verseStart: 5,
    verseEnd: null,
    referenceLabel: "Isaia 53:5",
    theme: "jertfa și rănile lui Hristos",
    reason: "Se potrivește cântărilor despre Golgota, cruce, răni, suferința Domnului și pacea adusă prin jertfa Lui.",
    keywords: ["golgota", "cruce", "rani", "strapuns", "zdrobit", "pacatele", "faradelegi", "pace", "tamaduire", "suferinta"],
    baseScore: 0.91,
  },
  {
    book: "Isaia",
    chapter: 43,
    verseStart: 1,
    verseEnd: null,
    referenceLabel: "Isaia 43:1",
    theme: "răscumpărat și chemat pe nume",
    reason: "Se potrivește cântărilor despre apartenență, răscumpărare, chemare pe nume și siguranță în Dumnezeu.",
    keywords: ["al tau", "sunt al tau", "rascumparat", "chemat pe nume", "nu te teme", "izbavesc", "apartin", "numele meu"],
    baseScore: 0.88,
  },
  {
    book: "Ioan",
    chapter: 10,
    verseStart: 11,
    verseEnd: null,
    referenceLabel: "Ioan 10:11",
    theme: "Păstorul cel bun",
    reason: "Se potrivește cântărilor despre Isus ca Păstor, grijă, călăuzire și jertfa pentru oi.",
    keywords: ["pastor", "pastorul", "bunul pastor", "oile", "calauzeste", "grija", "toiag", "pasuni", "da viata"],
    baseScore: 0.88,
  },
  {
    book: "Ioan",
    chapter: 11,
    verseStart: 25,
    verseEnd: null,
    referenceLabel: "Ioan 11:25",
    theme: "învierea și viața",
    reason: "Se potrivește cântărilor despre înviere, viață, moarte biruită și nădejde în Hristos.",
    keywords: ["invierea", "inviat", "viata", "traieste", "moartea", "mormant", "biruit", "viu"],
    baseScore: 0.91,
  },
  {
    book: "Ioan",
    chapter: 15,
    verseStart: 5,
    verseEnd: null,
    referenceLabel: "Ioan 15:5",
    theme: "rămânere în Hristos și rodire",
    reason: "Se potrivește cântărilor despre rămânere în Domnul, dependență de El și rod spiritual.",
    keywords: ["raman", "ramai", "vita", "mladite", "rod", "despartiti", "fara tine", "dependenta"],
    baseScore: 0.84,
  },
  {
    book: "Romani",
    chapter: 10,
    verseStart: 9,
    verseEnd: null,
    referenceLabel: "Romani 10:9",
    theme: "mărturisirea lui Isus ca Domn",
    reason: "Se potrivește cântărilor care proclamă că Isus este Domnul și cheamă la credință în învierea Lui.",
    keywords: ["isus este domnul", "hristos e domnul", "domn", "marturisesc", "cred", "inviat", "mantuit"],
    baseScore: 0.9,
  },
  {
    book: "2 Corinteni",
    chapter: 12,
    verseStart: 9,
    verseEnd: null,
    referenceLabel: "2 Corinteni 12:9",
    theme: "har suficient în slăbiciune",
    reason: "Se potrivește cântărilor despre har, slăbiciune, puterea Domnului și sprijin în neputință.",
    keywords: ["har", "slabiciune", "neputinta", "puterea ta", "ajunge", "indestulator", "putere", "sprijin"],
    baseScore: 0.87,
  },
  {
    book: "Evrei",
    chapter: 4,
    verseStart: 16,
    verseEnd: null,
    referenceLabel: "Evrei 4:16",
    theme: "apropiere de tronul harului",
    reason: "Se potrivește cântărilor despre rugăciune, apropiere de Dumnezeu, har și ajutor la vreme de nevoie.",
    keywords: ["rugaciune", "ma apropii", "tron", "scaunul harului", "har", "indurare", "ajutor", "nevoie"],
    baseScore: 0.86,
  },
  {
    book: "Evrei",
    chapter: 12,
    verseStart: 2,
    verseEnd: null,
    referenceLabel: "Evrei 12:2",
    theme: "privirea ațintită la Isus",
    reason: "Se potrivește cântărilor despre a privi la Isus, credință, cruce și alergare spirituală.",
    keywords: ["priveste", "ochii", "tinta", "isus", "credinta", "cruce", "alergare", "urma"],
    baseScore: 0.86,
  },
  {
    book: "Apocalipsa",
    chapter: 22,
    verseStart: 20,
    verseEnd: null,
    referenceLabel: "Apocalipsa 22:20",
    theme: "venirea Domnului",
    reason: "Se potrivește cântărilor despre revenirea Domnului, dorul după cer și chemarea «Vino, Doamne Isuse». ",
    keywords: ["vino doamne", "maranata", "vine curand", "revenire", "astept", "cer", "acasa", "doamne isuse"],
    baseScore: 0.89,
  },

];

const genericKeywords = new Set([
  // Păstrăm aici doar cuvinte care apar în aproape orice cântare și nu indică singure o temă.
  // „Isus”, „Hristos”, „Domnul”, „Dumnezeu” NU sunt tratate ca zgomot, pentru că în titlu
  // pot orienta corect sugestia spre domnia lui Hristos, mântuire, cruce, înviere etc.
  "aleluia",
  "amin",
  "slava",
  "slavim",
  "lauda",
  "laudati",
  "cantare",
  "cantati",
]);

function keywordVariants(keyword: string) {
  const normalized = normalizeText(keyword);
  const variants = new Set([normalized]);
  if (normalized.endsWith("a")) variants.add(normalized.slice(0, -1));
  if (normalized.endsWith("e")) variants.add(normalized.slice(0, -1));
  if (normalized.endsWith("i")) variants.add(normalized.slice(0, -1));
  if (normalized.endsWith("ul")) variants.add(normalized.slice(0, -2));
  if (normalized.endsWith("ului")) variants.add(normalized.slice(0, -4));
  return Array.from(variants).filter((item) => item.length >= 3);
}

function keywordMatches(normalizedHaystack: string, keyword: string) {
  const normalizedKeyword = normalizeText(keyword);

  if (normalizedKeyword.includes(" ")) {
    return keywordVariants(normalizedKeyword).some((variant) => normalizedHaystack.includes(variant));
  }

  const haystackTokens = normalizedHaystack
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  const variants = keywordVariants(normalizedKeyword);

  return haystackTokens.some((token) =>
    variants.some((variant) => {
      if (variant.length < 3) return false;
      if (token === variant) return true;
      // Potrivire morfologică simplă pentru română: înviere/înviat/înviază, mântuire/mântuit, iubire/iubit etc.
      if (variant.length >= 4 && token.startsWith(variant)) return true;
      if (token.length >= 4 && variant.startsWith(token)) return true;
      return false;
    }),
  );
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

const titleStopWords = new Set([
  "este",
  "esti",
  "sunt",
  "suntem",
  "meu",
  "mea",
  "mele",
  "tale",
  "tau",
  "ta",
  "cel",
  "cea",
  "cei",
  "ale",
  "care",
  "prin",
  "pentru",
  "intr",
  "din",
  "spre",
]);

function compactTitleTokens(title: string) {
  return unique(
    normalizeText(title)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !titleStopWords.has(token)),
  );
}

function countKeywordMatches(haystack: string, keywords: string[]) {
  return keywords.filter((keyword) => keywordMatches(haystack, keyword));
}

export function suggestBibleVersesForSong(input: {
  title?: string | null;
  lyricsText?: string | null;
  limit?: number;
}) {
  const titleNormalized = normalizeText(input.title || "");
  const lyricsNormalized = normalizeText(input.lyricsText || "");
  const fullNormalized = `${titleNormalized}\n${lyricsNormalized}`;
  const titleTokens = compactTitleTokens(input.title || "");
  const limit = input.limit ?? 10;

  const scored = templates.map((template, index) => {
    const titleMatches = unique(countKeywordMatches(titleNormalized, template.keywords));
    const lyricMatches = unique(countKeywordMatches(lyricsNormalized, template.keywords));
    const fullMatches = unique(countKeywordMatches(fullNormalized, template.keywords));

    const meaningfulTitleMatches = titleMatches.filter(
      (keyword) => !genericKeywords.has(normalizeText(keyword)),
    );
    const meaningfulLyricMatches = lyricMatches.filter(
      (keyword) => !genericKeywords.has(normalizeText(keyword)),
    );

    const titleTokenMatches = titleTokens.filter((token) =>
      template.keywords.some((keyword) => keywordVariants(keyword).includes(token) || normalizeText(keyword).includes(token)),
    );

    // Titlul cântării are prioritate. Versurile sunt folosite ca al doilea strat de potrivire.
    // Astfel, „Isus Hristos e Domnul” va primi versete despre domnia lui Hristos,
    // iar nu aceeași listă generică pentru toate cântările.
    const titleScore =
      meaningfulTitleMatches.length * 0.24 +
      titleMatches.length * 0.07 +
      titleTokenMatches.length * 0.09;
    const lyricsScore =
      meaningfulLyricMatches.length * 0.095 +
      lyricMatches.length * 0.018;
    const exactTitlePhraseBonus = template.keywords.some((keyword) =>
      keyword.includes(" ") && titleNormalized.includes(normalizeText(keyword)),
    )
      ? 0.24
      : 0;

    const matchScore = titleScore + lyricsScore + exactTitlePhraseBonus;
    const score = Math.min(0.99, Math.max(0.32, (template.baseScore ?? 0.72) - 0.16 + matchScore));

    return {
      id: `${template.book}-${template.chapter}-${template.verseStart}-${template.verseEnd || ""}-${index}`.replace(
        /\s+/g,
        "-",
      ),
      book: template.book,
      chapter: template.chapter,
      verseStart: template.verseStart,
      verseEnd: template.verseEnd,
      referenceLabel: template.referenceLabel,
      theme: template.theme,
      reason:
        meaningfulTitleMatches.length > 0 || titleTokenMatches.length > 0 || exactTitlePhraseBonus > 0
          ? `${template.reason} Potrivirea principală vine din titlul cântării.`
          : template.reason,
      confidence: score,
      matchedKeywords: unique([...titleMatches, ...lyricMatches, ...titleTokenMatches]),
      titleSignalCount: meaningfulTitleMatches.length + titleTokenMatches.length + (exactTitlePhraseBonus > 0 ? 1 : 0),
      lyricSignalCount: meaningfulLyricMatches.length,
      totalSignalCount: meaningfulTitleMatches.length + titleTokenMatches.length + meaningfulLyricMatches.length + (exactTitlePhraseBonus > 0 ? 1 : 0),
      fullMatchCount: fullMatches.length,
    };
  });

  return scored
    .filter((item) => item.totalSignalCount > 0 || item.fullMatchCount >= 2)
    .sort(
      (a, b) =>
        b.titleSignalCount - a.titleSignalCount ||
        b.confidence - a.confidence ||
        b.lyricSignalCount - a.lyricSignalCount ||
        b.matchedKeywords.length - a.matchedKeywords.length,
    )
    .slice(0, limit)
    .map(({ titleSignalCount, lyricSignalCount, totalSignalCount, fullMatchCount, ...item }) => item as BibleVerseSuggestion);
}

export function serializeBibleVerseSuggestion(
  suggestion: BibleVerseSuggestion,
) {
  return JSON.stringify({
    book: suggestion.book,
    chapter: suggestion.chapter,
    verseStart: suggestion.verseStart,
    verseEnd: suggestion.verseEnd,
    referenceLabel: suggestion.referenceLabel,
    theme: suggestion.theme,
    reason: suggestion.reason,
    confidence: suggestion.confidence,
  });
}
