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
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function suggestBibleVersesForSong(input: {
  title?: string | null;
  lyricsText?: string | null;
  limit?: number;
}) {
  const normalized = normalizeText(
    `${input.title || ""}\n${input.lyricsText || ""}`,
  );
  const titleNormalized = normalizeText(input.title || "");
  const limit = input.limit ?? 10;

  const scored = templates.map((template, index) => {
    const matchedKeywords = unique(
      template.keywords.filter((keyword) =>
        normalized.includes(normalizeText(keyword)),
      ),
    );
    const titleMatches = template.keywords.filter((keyword) =>
      titleNormalized.includes(normalizeText(keyword)),
    ).length;
    const matchScore = matchedKeywords.length * 0.045 + titleMatches * 0.035;
    const score = Math.min(0.98, (template.baseScore ?? 0.75) + matchScore);

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
      reason: template.reason,
      confidence:
        matchedKeywords.length > 0
          ? score
          : Math.min(0.68, template.baseScore ?? 0.65),
      matchedKeywords,
    } satisfies BibleVerseSuggestion;
  });

  const withMatches = scored.filter((item) => item.matchedKeywords.length > 0);
  const fallback = scored
    .filter((item) => item.matchedKeywords.length === 0)
    .slice(0, 4);

  return [...withMatches, ...fallback]
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        b.matchedKeywords.length - a.matchedKeywords.length,
    )
    .slice(0, limit);
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
