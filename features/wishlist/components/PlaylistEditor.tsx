"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { requestJson } from "@/lib/client-request";
import type { SongSearchResult } from "@/features/meetings/types";
import {
  addPlaylistSongAction,
  movePlaylistItemAction,
  removePlaylistItemAction,
  updatePlaylistAction,
  updatePlaylistItemAction,
  deletePlaylistAction,
  setPlaylistVisibilityAction,
} from "@/features/wishlist/server/actions";
import { SongLyricsTooltip } from "@/components/SongLyricsTooltip";
import { YouTubePlayButton } from "@/components/YouTubePlayButton";
import { collectionStyle, type CollectionSource } from "@/lib/collection-colors";
import { SourceTags } from "@/components/SourceTags";
import { eventDateTime, monthOf, scheduleEventLabel } from "@/lib/song-schedule";
import { SongScheduleModal } from "@/components/SongScheduleModal";
import { MoveWishlistSongDialog } from "./MoveWishlistSongDialog";
import { CopyButton } from "@/components/CopyButton";
import type { Wishlist } from "@/features/wishlist/types";

export type RehearsalPlaylist = Wishlist;
export function PlaylistEditor({
  initial,
  editable,
  siteUrl,
}: {
  initial: Wishlist;
  editable: boolean;
  siteUrl: string;
}) {
  const searchId = useId(),
    [playlist, setPlaylist] = useState(initial),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<SongSearchResult[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [searching, setSearching] = useState(false),
    [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [advanced, setAdvanced] = useState(false),
    [filters, setFilters] = useState({ collection: "", category: "", key: "" }),
    [calendar, setCalendar] = useState<SongSearchResult | null>(null);
  const [options, setOptions] = useState<{
    collections: Array<{ id: string; name: string }>;
    categories: Array<{ id: string; name: string }>;
    keys: string[];
  }>({ collections: [], categories: [], keys: [] });
  useEffect(() => {
    setPlaylist(initial);
  }, [initial]);
  useEffect(() => {
    if (!advanced) return;
    const controller = new AbortController();
    requestJson<typeof options>("/api/songs/search-options", { signal: controller.signal, cache: "no-store" })
      .then(setOptions)
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Filtrele nu au putut fi încărcate.");
      });
    return () => controller.abort();
  }, [advanced]);
  useEffect(() => {
    const q = query.trim(),
      controller = new AbortController(),
      hasFilter = Object.values(filters).some(Boolean);
    if (q.length < 2 && !/^\d$/.test(q) && !hasFilter) {
      setResults([]);
      setSearching(false);
      setError("");
      return;
    }
    setSearching(true);
    setResults([]);
    setError("");
    const timer = setTimeout(
      () =>
        requestJson<SongSearchResult[]>(
          `/api/songs/search?q=${encodeURIComponent(q)}&${new URLSearchParams(filters)}`,
          { signal: controller.signal, cache: "no-store" },
        )
          .then(setResults)
          .catch((e) => {
            if (!controller.signal.aborted)
              setError(e instanceof Error ? e.message : "Căutarea nu este disponibilă momentan.");
          })
          .finally(() => {
            if (!controller.signal.aborted) setSearching(false);
          }),
      180,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, filters]);
  const apply = (job: () => Promise<unknown>, success?: string) => {
    setError("");
    setMessage("");
    start(async () => {
      try {
        const data = await job();
        if (data && typeof data === "object" && "items" in data) setPlaylist(data as Wishlist);
        if (success) setMessage(success);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Modificarea nu a putut fi salvată.");
      }
    });
  };
  const add = (song: SongSearchResult) =>
    apply(async () => {
      const data = await addPlaylistSongAction({ playlistId: playlist.id, songId: song.song_id });
      setQuery("");
      setResults([]);
      input.current?.focus({ preventScroll: true });
      return data;
    }, "Cântarea a fost adăugată în wishlist.");
  return (
    <div className="playlist-workspace">
      <section className="card playlist-main">
        <div className="playlist-toolbar">
          <div>
            <h2>
              Cântări notate <span className="badge">{playlist.items.length}</span>
            </h2>
            <p className="muted small">Le poți muta, comenta sau elimina fără a afecta programele.</p>
          </div>
        </div>
        {editable ? (
          <section className="playlist-search program-song-search" aria-labelledby={searchId + "-label"}>
            <label className="sr-only" id={searchId + "-label"} htmlFor={searchId + "-input"}>
              Adaugă o cântare în wishlist
            </label>
            <input
              id={searchId + "-input"}
              ref={input}
              className="input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setMessage("");
              }}
              placeholder="Caută titlu, versuri sau număr (ex: 380)"
              autoComplete="off"
              maxLength={300}
            />
            {query ? (
              <button
                type="button"
                className="quiet-button search-reset"
                aria-label="Șterge căutarea din wishlist"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setMessage("");
                  input.current?.focus();
                }}
              >
                Șterge căutarea
              </button>
            ) : null}
            <p className="song-search-status" aria-live="polite">
              {searching
                ? "Se caută…"
                : results.length
                  ? `${results.length} ${results.length === 1 ? "cântare găsită" : "cântări găsite"} · verifică colecția`
                  : query.trim().length >= 2 || Object.values(filters).some(Boolean)
                    ? "Nicio cântare găsită."
                    : "Scrie titlul sau numărul cântării."}
            </p>
            <div className="advanced-search-tools">
              <button
                type="button"
                className="quiet-button"
                aria-expanded={advanced}
                aria-controls={searchId + "-advanced"}
                onClick={() => setAdvanced(!advanced)}
              >
                Căutare avansată{" "}
                {Object.values(filters).filter(Boolean).length
                  ? `(${Object.values(filters).filter(Boolean).length})`
                  : ""}{" "}
                {advanced ? "▴" : "▾"}
              </button>
              {Object.values(filters).some(Boolean) ? (
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => setFilters({ collection: "", category: "", key: "" })}
                >
                  Resetează filtrele
                </button>
              ) : null}
            </div>
            {advanced ? (
              <div className="advanced-search-fields" id={searchId + "-advanced"}>
                <label className="label">
                  Colecție
                  <select
                    className="select"
                    value={filters.collection}
                    onChange={(e) => setFilters({ ...filters, collection: e.target.value })}
                  >
                    <option value="">Toate colecțiile</option>
                    {options.collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  Categorie
                  <select
                    className="select"
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  >
                    <option value="">Toate categoriile</option>
                    {options.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  Tonalitate
                  <select
                    className="select"
                    value={filters.key}
                    onChange={(e) => setFilters({ ...filters, key: e.target.value })}
                  >
                    <option value="">Toate tonalitățile</option>
                    {options.keys.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            <div className="song-search-results" aria-busy={searching}>
              {results.flatMap((song) => {
                const numeric = query
                  .trim()
                  .replace(/^nr\.?\s*/i, "")
                  .replace(/^0+(?=\d)/, "");
                const activeSources = song.sources?.filter((source) => source.is_active !== false);
                const exact = activeSources?.filter(
                  (source) => String(source.number || "").replace(/^0+(?=\d)/, "") === numeric,
                );
                const variants: ReadonlyArray<CollectionSource | null> = exact?.length
                  ? exact
                  : activeSources?.length
                    ? activeSources
                    : [null];
                const added = playlist.items.some((item) => item.song.id === song.song_id);
                return variants.map((source) => (
                  <article
                    className="song-pick-row collection-colored"
                    key={song.song_id + ":" + (source?.source_id || "none")}
                    style={collectionStyle(source)}
                  >
                    <div className="song-pick-content">
                      <Link
                        href={`/songs/${song.song_id}?returnTo=${encodeURIComponent(`/playlists/${playlist.id}`)}`}
                        className="row-title"
                      >
                        {song.title}
                      </Link>
                      <div className="badges compact-badges">
                        <span className="badge">Tonalitate {song.default_key || "—"}</span>
                        <SourceTags source={source} />
                        <span className="badge">
                          {song.verse_count == null ? "Strofe: —" : `${song.verse_count} strofe`}
                        </span>
                        <SongLyricsTooltip songId={song.song_id} title={song.title} preview={song} />
                      </div>
                      <div className="search-schedule-summary">
                        {song.schedule?.next ? (
                          <p className="planned-warning">
                            {scheduleEventLabel(song.schedule.next)}{" "}
                            <strong>{eventDateTime(song.schedule.next.meeting_date)}</strong>
                            {song.schedule.next.is_backup ? " · backup" : ""}
                          </p>
                        ) : null}
                        {song.schedule?.last ? (
                          <p>
                            {scheduleEventLabel(song.schedule.last)}{" "}
                            <strong>{eventDateTime(song.schedule.last.meeting_date)}</strong>
                          </p>
                        ) : null}
                        <button
                          type="button"
                          className="quiet-button"
                          onClick={() => setCalendar(song)}
                          aria-label={`Calendar și istoric pentru ${song.title}`}
                        >
                          Calendar și istoric
                        </button>
                      </div>
                    </div>
                    <div className="song-pick-actions">
                      <button
                        className="btn btn-compact"
                        type="button"
                        disabled={pending || added}
                        onClick={() => add(song)}
                      >
                        {added ? "Adăugată" : "Adaugă"}
                      </button>
                    </div>
                  </article>
                ));
              })}
            </div>
          </section>
        ) : null}
        {message ? (
          <p className="success" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="playlist-items">
          {playlist.items.map((item, index) => (
            <article className="playlist-song-row" key={item.id}>
              <span className="program-position">{index + 1}</span>
              <div className="playlist-song-copy">
                <div className="playlist-song-heading">
                  <Link
                    href={`/songs/${item.song.id}?returnTo=${encodeURIComponent(`/playlists/${playlist.id}`)}`}
                  >
                    {item.song.title}
                  </Link>
                  <div className="badges compact-badges">
                    {item.song.default_key ? (
                      <span className="badge">Tonalitate {item.song.default_key}</span>
                    ) : null}
                    <SongLyricsTooltip songId={item.song.id} title={item.song.title} />
                    {item.song.youtube_url ? (
                      <YouTubePlayButton url={item.song.youtube_url} title={item.song.title} />
                    ) : null}
                  </div>
                </div>
                {editable ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const notes = String(new FormData(event.currentTarget).get("notes") || "");
                      apply(
                        () => updatePlaylistItemAction({ playlistId: playlist.id, itemId: item.id, notes }),
                        "Observația a fost salvată.",
                      );
                    }}
                    className="playlist-note-form"
                  >
                    <input
                      className="input input-tight"
                      name="notes"
                      defaultValue={item.notes || ""}
                      placeholder="Observație pentru repetiție"
                      maxLength={2000}
                    />
                    <button className="btn secondary btn-compact" disabled={pending}>
                      Salvează
                    </button>
                  </form>
                ) : item.notes ? (
                  <p>{item.notes}</p>
                ) : null}
              </div>
              {editable ? (
                <div className="playlist-row-actions">
                  <MoveWishlistSongDialog
                    playlistId={playlist.id}
                    itemId={item.id}
                    title={item.song.title}
                    onMoved={(data) => {
                      if (data && typeof data === "object" && "items" in data) setPlaylist(data as Wishlist);
                      setMessage("Cântarea a fost mutată în program.");
                    }}
                  />
                  <button
                    className="icon-btn"
                    disabled={pending || index === 0}
                    onClick={() =>
                      apply(() =>
                        movePlaylistItemAction({ playlistId: playlist.id, itemId: item.id, direction: "up" }),
                      )
                    }
                    aria-label="Mută mai sus"
                  >
                    ↑
                  </button>
                  <button
                    className="icon-btn"
                    disabled={pending || index === playlist.items.length - 1}
                    onClick={() =>
                      apply(() =>
                        movePlaylistItemAction({
                          playlistId: playlist.id,
                          itemId: item.id,
                          direction: "down",
                        }),
                      )
                    }
                    aria-label="Mută mai jos"
                  >
                    ↓
                  </button>
                  <button
                    className="btn secondary btn-compact danger-text"
                    disabled={pending}
                    onClick={() =>
                      apply(
                        () => removePlaylistItemAction({ playlistId: playlist.id, itemId: item.id }),
                        "Cântarea a fost eliminată din wishlist.",
                      )
                    }
                  >
                    Elimină
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {!playlist.items.length ? <p className="surface-empty">Caută și adaugă prima cântare.</p> : null}
        </div>
        {calendar ? (
          <SongScheduleModal
            songId={calendar.song_id}
            title={calendar.title}
            initialMonth={monthOf(
              calendar.schedule?.next?.meeting_date ||
                calendar.schedule?.last?.meeting_date ||
                new Date().toISOString(),
            )}
            onClose={() => setCalendar(null)}
          />
        ) : null}
      </section>
      {editable ? (
        <aside className="playlist-settings">
          <details className="card" open>
            <summary>Vizibilitate și distribuire</summary>
            <div className="form-grid playlist-sharing">
              <div>
                <strong>{playlist.is_public ? "Wishlist public" : "Wishlist privat"}</strong>
                <p className="muted small">
                  {playlist.is_public
                    ? "Oricine are linkul poate vedea lista și poate adăuga direct cântări. Echipa poate elimina oricând un element."
                    : "Doar utilizatorii autentificați pot deschide acest wishlist."}
                </p>
              </div>
              <button
                className={`btn ${playlist.is_public ? "secondary" : ""}`}
                type="button"
                disabled={pending}
                onClick={() =>
                  apply(
                    () =>
                      setPlaylistVisibilityAction({ playlistId: playlist.id, isPublic: !playlist.is_public }),
                    playlist.is_public ? "Wishlistul este acum privat." : "Wishlistul este acum public.",
                  )
                }
              >
                {playlist.is_public ? "Fă privat" : "Publică wishlistul"}
              </button>
              {playlist.is_public && playlist.public_slug ? (
                <div className="wishlist-share-actions">
                  <Link
                    className="btn secondary btn-compact"
                    href={`/wishlist/${playlist.public_slug}`}
                    target="_blank"
                  >
                    Vezi public
                  </Link>
                  <CopyButton text={`${siteUrl}/wishlist/${playlist.public_slug}`} />
                </div>
              ) : null}
            </div>
          </details>
          <details className="card" open>
            <summary>Detalii wishlist</summary>
            <form action={updatePlaylistAction} className="form-grid">
              <input type="hidden" name="playlist_id" value={playlist.id} />
              <label className="label">
                Nume
                <input className="input" name="name" defaultValue={playlist.name} required maxLength={120} />
              </label>
              <label className="label">
                Observații
                <textarea
                  className="textarea textarea-tight"
                  name="notes"
                  defaultValue={playlist.notes || ""}
                  maxLength={5000}
                />
              </label>
              <button className="btn secondary">Salvează detaliile</button>
            </form>
          </details>
          <details className="card danger-card">
            <summary>Șterge wishlistul</summary>
            <form action={deletePlaylistAction} className="form-grid">
              <input type="hidden" name="playlist_id" value={playlist.id} />
              <label className="label">
                Confirmare
                <input className="input" name="confirm" placeholder="scrie: STERGE" />
              </label>
              <button className="btn danger">Șterge wishlistul</button>
            </form>
          </details>
        </aside>
      ) : null}
    </div>
  );
}
