import type { SupabaseClient } from '@supabase/supabase-js';

const TITLE_WEIGHT = 3;
const LYRICS_WEIGHT = 1;

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ăâîșţț\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const THEME_QUERIES = [
  { theme: 'Domnia lui Hristos', terms: ['hristos domnul', 'isus domnul', 'domn al domnilor', 'imparat', 'imparatie', 'domneste'], query: 'Hristos Domnul Împărat domnește' },
  { theme: 'Cruce / Golgota / jertfă', terms: ['golgota', 'cruce', 'jertfa', 'sange', 'rastignit', 'calvar'], query: 'cruce jertfă sânge răscumpărare Hristos' },
  { theme: 'Înviere', terms: ['inviat', 'inviere', 'mormant', 'viu', 'traieste'], query: 'înviere Hristos viu mormânt' },
  { theme: 'Mântuire / răscumpărare', terms: ['mantuire', 'mantuit', 'rascumparare', 'iertare', 'iertat', 'salvare'], query: 'mântuire răscumpărare iertare har' },
  { theme: 'Încredere în încercare', terms: ['furtuna', 'necaz', 'durere', 'lacrimi', 'incercare', 'teama', 'frica'], query: 'Domnul adăpost ajutor necaz teamă' },
  { theme: 'Laudă / închinare', terms: ['lauda', 'laudati', 'cantare', 'slava', 'glorie', 'inchinare', 'osana'], query: 'laudă cântare slavă Domnul' },
  { theme: 'Cer / nădejde veșnică', terms: ['cer', 'vesnic', 'vesnicie', 'patrie', 'acasa', 'rai'], query: 'cer nou veșnicie nădejde' },
  { theme: 'Duhul Sfânt / călăuzire', terms: ['duh', 'mangaietor', 'calauzire', 'calauzeste'], query: 'Duhul Sfânt călăuzire mângâietor' },
  { theme: 'Rugăciune', terms: ['rugaciune', 'ma rog', 'strig', 'asculta', 'cerere'], query: 'rugăciune ascultă strigătul meu' },
  { theme: 'Dragostea lui Dumnezeu', terms: ['dragoste', 'iubire', 'iubesti', 'iubit'], query: 'dragostea lui Dumnezeu iubire' },
  { theme: 'Păstorul cel bun', terms: ['pastor', 'pasune', 'oaie', 'turma'], query: 'Păstorul cel bun oile Mele' },
  { theme: 'Lumina lumii', terms: ['lumina', 'intuneric', 'straluceste'], query: 'lumina lumii întuneric' },
  { theme: 'Venirea Domnului', terms: ['vine domnul', 'revenire', 'astept', 'mire', 'mireasa'], query: 'vin curând venirea Domnului' }
];

export type BibleSuggestion = {
  referenceLabel: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  theme: string;
  reason: string;
  score: number;
};

export async function getFullBibleSuggestionsForSong(
  supabase: SupabaseClient,
  song: { title: string; lyrics_text?: string | null },
  limit = 10
): Promise<BibleSuggestion[]> {
  const title = normalize(song.title || '');
  const lyrics = normalize(song.lyrics_text || '');
  const matches = THEME_QUERIES
    .map((theme) => {
      const titleHits = theme.terms.filter((term) => title.includes(normalize(term))).length;
      const lyricHits = theme.terms.filter((term) => lyrics.includes(normalize(term))).length;
      return { ...theme, score: titleHits * TITLE_WEIGHT + lyricHits * LYRICS_WEIGHT, titleHits, lyricHits };
    })
    .filter((theme) => theme.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const suggestions: BibleSuggestion[] = [];
  const seen = new Set<string>();

  for (const theme of matches) {
    const { data, error } = await supabase.rpc('search_bible_verses', {
      p_query: theme.query,
      p_limit: 6,
      p_version_code: 'RCCV'
    });
    if (error) continue;
    for (const row of data || []) {
      const key = row.reference_label;
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push({
        referenceLabel: row.reference_label,
        bookName: row.book_name,
        chapter: row.chapter,
        verse: row.verse,
        text: row.text,
        theme: theme.theme,
        reason: theme.titleHits > 0
          ? `Potrivire cu titlul cântării și tema: ${theme.theme}.`
          : `Potrivire cu versurile cântării și tema: ${theme.theme}.`,
        score: theme.score + Number(row.rank || 0)
      });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, limit);
}
