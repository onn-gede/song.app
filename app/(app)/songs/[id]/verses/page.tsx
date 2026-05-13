import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildStableBibleSourceUrl } from "@/lib/freeBibleText";
import { stripRepeatedSongTitleLines } from "@/lib/songTextCleanup";
import {
  addSongBibleReferenceAction,
  addSuggestedBibleReferencesAction,
  deleteSongBibleReferenceAction,
  fetchBibleTextForReferenceAction,
  fetchAllBibleTextsForSongAction,
  getBibleTextPreviewForSuggestionAction,
} from "../../actions";
import {
  serializeBibleVerseSuggestion,
  suggestBibleVersesForSong,
} from "@/lib/bibleSuggestions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    deleted?: string;
    suggestions_saved?: string;
    text_fetched?: string;
    texts_fetched?: string;
    text_error?: string;
  }>;
};

function stableReferenceUrl(ref: any) {
  const sourceUrl = ref?.source_url as string | null | undefined;
  if (sourceUrl && !sourceUrl.includes("bible-api.com")) return sourceUrl;
  if (ref?.book && ref?.chapter && ref?.verse_start) {
    return buildStableBibleSourceUrl(ref.book, Number(ref.chapter), Number(ref.verse_start), ref.verse_end ? Number(ref.verse_end) : null);
  }
  return sourceUrl || "https://archive.org/details/bibliacornilescu1921";
}

function verseLink(ref: any) {
  const label = ref?.reference_label || "Referință biblică";
  const href = stableReferenceUrl(ref);
  return (
    <a className="reference-link" href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

function suggestionSourceUrl(suggestion: any) {
  return buildStableBibleSourceUrl(suggestion.book, suggestion.chapter, suggestion.verseStart, suggestion.verseEnd);
}

export default async function SongVersesPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: song }, { data: sections }, { data: sources }, { data: refs }] = await Promise.all([
    supabase
      .from("songs")
      .select("id,title,lyrics_text,default_key,bpm,structure")
      .eq("id", id)
      .single(),
    supabase
      .from("song_sections")
      .select("content,position")
      .eq("song_id", id)
      .order("position"),
    supabase
      .from("song_sources")
      .select("song_number")
      .eq("song_id", id),
    supabase
      .from("song_bible_references")
      .select(
        "id,theme,reason,confidence,created_at,bible_references(id,version,book,chapter,verse_start,verse_end,reference_label,text_cache,source_url,copyright_notes)",
      )
      .eq("song_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!song) notFound();

  const refsList = refs || [];
  const missingTextCount = refsList.filter((item: any) => !item.bible_references?.text_cache).length;
  const existingReferenceLabels = new Set(
    refsList
      .map((item: any) => item.bible_references?.reference_label)
      .filter(Boolean),
  );
  const sourceNumbers = (sources || []).map((source: any) => String(source.song_number || "")).filter(Boolean);
  const cleanedLyricsForSuggestions = ((sections || []).length > 0
    ? (sections || []).map((section: any) => stripRepeatedSongTitleLines(section.content, song.title, sourceNumbers)).join("\n\n")
    : stripRepeatedSongTitleLines(song.lyrics_text, song.title, sourceNumbers)
  ).trim();

  const suggestions = suggestBibleVersesForSong({
    title: song.title,
    lyricsText: cleanedLyricsForSuggestions,
    limit: 10,
  }).filter(
    (suggestion) => !existingReferenceLabels.has(suggestion.referenceLabel),
  );

  const suggestionPreviews = new Map(
    await Promise.all(
      suggestions.map(async (suggestion) => {
        const preview = await getBibleTextPreviewForSuggestionAction({
          book: suggestion.book,
          chapter: suggestion.chapter,
          verseStart: suggestion.verseStart,
          verseEnd: suggestion.verseEnd,
        });
        return [suggestion.id, preview] as const;
      }),
    ),
  );

  return (
    <>
      <div className="top-row">
        <div>
          <div className="eyebrow">Versete biblice</div>
          <h1>{song.title}</h1>
          <div className="badges" style={{ marginTop: 10 }}>
            {song.default_key ? <span className="badge">Tonalitate: {song.default_key}</span> : null}
            {song.bpm ? <span className="badge">{song.bpm} BPM</span> : null}
            {song.structure ? <span className="badge">Structură: {song.structure}</span> : null}
          </div>
        </div>
        <div className="inline-form">
          <Link className="btn secondary" href={`/songs/${song.id}`}>Înapoi la cântare</Link>
        </div>
      </div>

      {query.saved ? <div className="success" style={{ marginBottom: 14 }}>Versetul a fost salvat.</div> : null}
      {query.suggestions_saved ? <div className="success" style={{ marginBottom: 14 }}>Sugestiile selectate au fost salvate: {query.suggestions_saved}.</div> : null}
      {query.deleted ? <div className="success" style={{ marginBottom: 14 }}>Asocierea a fost ștearsă.</div> : null}
      {query.text_fetched ? <div className="success" style={{ marginBottom: 14 }}>Textul versetului a fost preluat și salvat.</div> : null}
      {query.texts_fetched ? <div className="success" style={{ marginBottom: 14 }}>Texte preluate și salvate: {query.texts_fetched}.</div> : null}
      {query.text_error ? <div className="error-box" style={{ marginBottom: 14 }}>Nu am putut prelua automat textul: {query.text_error}</div> : null}

      <div className="grid grid-2 song-edit-layout">
        <div className="grid">
          <section className="card">
            <div className="inline-form" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2>Sugestii tematice</h2>
                <p className="muted small">
                  Sugestiile sunt generate în momentul deschiderii acestei pagini, pe baza titlului și versurilor cântării curente. Nu mai afișăm fallback generic dacă nu există potriviri tematice reale.
                </p>
              </div>
              <span className="badge">draft</span>
            </div>

            {suggestions.length > 0 ? (
              <form action={addSuggestedBibleReferencesAction} className="form-grid">
                <input type="hidden" name="song_id" value={song.id} />
                <div className="list">
                  {suggestions.map((suggestion) => {
                    const preview = suggestionPreviews.get(suggestion.id);
                    const sourceHref = preview?.url || suggestionSourceUrl(suggestion);
                    return (
                      <label className="suggestion-card" key={suggestion.id}>
                        <input type="checkbox" name="selected_suggestions" value={serializeBibleVerseSuggestion(suggestion)} />
                        <div>
                          <div className="inline-form" style={{ gap: 8, justifyContent: "space-between" }}>
                            <a className="reference-link" href={sourceHref} target="_blank" rel="noreferrer">
                              {suggestion.referenceLabel}
                            </a>
                            <span className="badge">{Math.round(suggestion.confidence * 100)}%</span>
                          </div>
                          {preview?.text ? (
                            <p className="bible-text" style={{ marginTop: 8 }}>{preview.text}</p>
                          ) : (
                            <p className="muted small" style={{ marginTop: 8 }}>
                              Nu am putut prelua automat textul pentru previzualizare. Poți salva referința și completa textul manual ulterior.
                              {preview?.error ? ` Detalii: ${preview.error}` : ""}
                            </p>
                          )}
                          <p className="muted small">Temă: {suggestion.theme}</p>
                          <p className="small">{suggestion.reason}</p>
                          {preview?.version ? <p className="muted small">Text sursă: {preview.version}</p> : null}
                          {suggestion.matchedKeywords.length > 0 ? (
                            <p className="muted small">Potrivire după: {suggestion.matchedKeywords.join(", ")}</p>
                          ) : (
                            <p className="muted small">Potrivire tematică calculată din cântarea curentă.</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                <button className="btn" type="submit">Salvează sugestiile bifate</button>
              </form>
            ) : (
              <p className="muted">Nu am găsit sugestii biblice suficient de specifice pe baza titlului și versurilor acestei cântări, sau toate sugestiile relevante sunt deja salvate.</p>
            )}
          </section>

          <section className="card">
            <h2>Adaugă verset potrivit</h2>
            <p className="muted small">
              Recomandare: salvează referința, tema și motivul. Bifează opțiunea de preluare automată ca să salvezi și textul biblic din fallback-ul local gratuit pentru versetele cunoscute; pentru alte referințe poți completa textul manual.
            </p>

            <form action={addSongBibleReferenceAction} className="form-grid">
              <input type="hidden" name="song_id" value={song.id} />

              <div className="form-two">
                <label className="label">Carte biblică<input className="input" name="book" placeholder="Ex: Psalmii" required /></label>
                <label className="label">Referință afișată opțional<input className="input" name="reference_label" placeholder="Ex: Psalmul 46:1" /></label>
              </div>

              <div className="form-two form-three-lite">
                <label className="label">Capitol<input className="input" name="chapter" type="number" min="1" required /></label>
                <label className="label">Verset început<input className="input" name="verse_start" type="number" min="1" required /></label>
                <label className="label">Verset final opțional<input className="input" name="verse_end" type="number" min="1" /></label>
              </div>

              <label className="label">Temă / potrivire<input className="input" name="theme" placeholder="Ex: încredere în Dumnezeu, înviere, pocăință" /></label>
              <label className="label">De ce se potrivește cu această cântare<textarea className="textarea" name="reason" placeholder="Explică pe scurt legătura dintre verset și tematica cântării." /></label>
              <label className="label">Link sursă opțional<input className="input" name="source_url" placeholder="https://archive.org/details/bibliacornilescu1921" /></label>

              <label className="inline-form small">
                <input name="auto_fetch_text" type="checkbox" defaultChecked />
                Preia automat textul versetului din sursa gratuită disponibilă
              </label>

              <details className="raw-import-box">
                <summary>Text exact verset — opțional</summary>
                <div className="grid" style={{ marginTop: 12 }}>
                  <p className="muted small">Poți completa manual textul sau poți lăsa aplicația să îl preia automat.</p>
                  <label className="label">Text verset<textarea className="textarea" name="text_cache" placeholder="Textul exact al versetului." /></label>
                  <label className="label">Notă drepturi/licență<input className="input" name="copyright_notes" placeholder="Ex: text preluat din sursă free" /></label>
                </div>
              </details>

              <button className="btn" type="submit">Salvează versetul</button>
            </form>
          </section>
        </div>

        <section className="card">
          <div className="inline-form" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ marginBottom: 0 }}>Versete asociate</h2>
            {missingTextCount > 0 ? (
              <form action={fetchAllBibleTextsForSongAction}>
                <input type="hidden" name="song_id" value={song.id} />
                <button className="btn secondary btn-compact" type="submit">Preia toate textele lipsă ({missingTextCount})</button>
              </form>
            ) : null}
          </div>
          <div className="list" style={{ marginTop: 14 }}>
            {refsList.map((item: any) => {
              const ref = item.bible_references;
              return (
                <div className="card-soft" key={item.id}>
                  <div className="inline-form" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      {verseLink(ref)}
                      <p className="muted small">{ref?.version || "RCCV - Protestant Romanian Corrected Cornilescu Version"}</p>
                    </div>
                    {item.theme ? <span className="badge">{item.theme}</span> : null}
                  </div>
                  {ref?.text_cache ? (
                    <p className="bible-text">{ref.text_cache}</p>
                  ) : (
                    <p className="muted small">Textul exact nu este salvat încă. Îl poți prelua automat din sursa gratuită disponibilă.</p>
                  )}
                  {item.reason ? <p className="small">{item.reason}</p> : null}
                  <div className="inline-form" style={{ marginTop: 8 }}>
                    {!ref?.text_cache ? (
                      <form action={fetchBibleTextForReferenceAction} className="inline-form">
                        <input type="hidden" name="song_id" value={song.id} />
                        <input type="hidden" name="reference_id" value={ref?.id || ""} />
                        <button className="btn secondary btn-compact" type="submit">Preia textul</button>
                      </form>
                    ) : null}
                    <a className="btn secondary btn-compact" href={stableReferenceUrl(ref)} target="_blank" rel="noreferrer">Deschide sursa originală</a>
                  </div>
                  {ref?.copyright_notes ? <p className="muted small">Notă: {ref.copyright_notes}</p> : null}

                  <form action={deleteSongBibleReferenceAction} className="inline-form" style={{ marginTop: 10 }}>
                    <input type="hidden" name="song_id" value={song.id} />
                    <input type="hidden" name="relation_id" value={item.id} />
                    <input className="input" name="confirm" placeholder="STERGE" style={{ maxWidth: 140 }} />
                    <button className="btn danger btn-compact" type="submit">Șterge asocierea</button>
                  </form>
                </div>
              );
            })}
            {refsList.length === 0 ? <p className="muted">Nu există încă versete asociate acestei cântări.</p> : null}
          </div>
        </section>
      </div>
    </>
  );
}
