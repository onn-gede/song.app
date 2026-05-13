import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { mergeDuplicateSongsAction } from "./actions";

type DuplicateSong = {
  id: string;
  title: string;
  default_key?: string | null;
  bpm?: number | null;
  created_at?: string | null;
  collections?: string | null;
  numbers?: string | null;
  lyrics_length?: number | null;
};

type DuplicateGroup = {
  group_key: string;
  title_hint: string;
  song_count: number;
  songs: DuplicateSong[];
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(new Date(value));
}

export default async function DuplicatesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const limit = Number.parseInt(String(params?.limit || "50"), 10) || 50;
  const merged = params?.merged === "1";
  const errorMessage = typeof params?.error === "string" ? params.error : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_duplicate_song_candidates", {
    p_limit: Math.min(Math.max(limit, 10), 200),
  });

  if (error) throw new Error(error.message);

  const groups = (data || []) as DuplicateGroup[];
  const totalCandidates = groups.reduce((sum, group) => sum + group.song_count, 0);

  return (
    <div className="stack duplicates-page">
      <div className="page-header row-between">
        <div>
          <p className="eyebrow">Bibliotecă</p>
          <h1>Duplicate cântări</h1>
          <p className="muted">
            Compară cântările cu titluri identice sau foarte apropiate și unifică versiunile duplicate într-o singură cântare principală.
          </p>
        </div>
        <Link href="/songs" className="btn secondary">Înapoi la cântări</Link>
      </div>

      {merged && (
        <div className="success">Duplicatele selectate au fost unificate. Programele, sursele, categoriile și versetele au fost mutate pe cântarea principală.</div>
      )}
      {errorMessage ? <div className="error">{errorMessage}</div> : null}

      <div className="grid two">
        <div className="card compact-card">
          <h2>Rezumat</h2>
          <p className="muted smallish">Au fost găsite {groups.length} grupuri posibile, cu {totalCandidates} cântări candidate.</p>
          <form className="inline-form" action="/duplicates">
            <label className="label compact-label">
              Grupuri afișate
              <select className="select" name="limit" defaultValue={String(limit)}>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </label>
            <button className="btn secondary" type="submit">Reîncarcă</button>
          </form>
        </div>
        <div className="card-soft compact-card">
          <h2>Cum funcționează</h2>
          <p className="muted smallish">
            Alege cântarea care rămâne principală, apoi bifează duplicatele care trebuie unificate. Cântarea principală își păstrează versurile; pe ea se mută programele, sursele, categoriile și versetele duplicate.
          </p>
          <p className="muted smallish">Pentru siguranță, fiecare unificare cere confirmarea textului <strong>UNIFICA</strong>.</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <h2>Nu am găsit duplicate evidente</h2>
          <p className="muted">Poți reveni după importuri noi sau după sincronizări externe.</p>
        </div>
      ) : (
        <div className="stack duplicate-groups">
          {groups.map((group, groupIndex) => {
            const defaultPrimary = group.songs[0]?.id;
            return (
              <form key={group.group_key} action={mergeDuplicateSongsAction} className="card duplicate-group-card">
                <div className="row-between duplicate-group-header">
                  <div>
                    <h2>{group.title_hint}</h2>
                    <p className="muted smallish">{group.song_count} variante posibile</p>
                  </div>
                  <span className="badge">Grup #{groupIndex + 1}</span>
                </div>

                <div className="duplicate-table">
                  <div className="duplicate-row duplicate-row-head">
                    <span>Principală</span>
                    <span>Unifică</span>
                    <span>Cântare</span>
                    <span>Surse</span>
                    <span>Info</span>
                  </div>
                  {group.songs.map((song, index) => (
                    <div className="duplicate-row" key={song.id}>
                      <label className="mini-radio">
                        <input type="radio" name="primary_song_id" value={song.id} defaultChecked={song.id === defaultPrimary} />
                        <span>Rămâne</span>
                      </label>
                      <label className="mini-radio">
                        <input type="checkbox" name="duplicate_song_ids" value={song.id} defaultChecked={index !== 0} />
                        <span>Duplicat</span>
                      </label>
                      <div className="duplicate-song-title">
                        <Link href={`/songs/${song.id}`}>{song.title}</Link>
                        <span className="muted smallish">creată: {formatDate(song.created_at)}</span>
                      </div>
                      <div className="muted smallish">
                        <strong>{song.collections || "Fără colecție"}</strong>
                        {song.numbers ? <><br />Nr. {song.numbers}</> : null}
                      </div>
                      <div className="muted smallish">
                        {song.default_key ? <>Ton: {song.default_key}<br /></> : null}
                        {song.bpm ? <>BPM: {song.bpm}<br /></> : null}
                        Text: {song.lyrics_length || 0} caractere
                      </div>
                    </div>
                  ))}
                </div>

                <div className="row-between duplicate-actions">
                  <p className="muted smallish">Recomandare: păstrează versiunea cu textul cel mai complet și șterge/unifică doar duplicatele clare.</p>
                  <div className="inline-actions">
                    <input className="input compact-confirm" name="confirm" placeholder="UNIFICA" />
                    <button className="btn" type="submit">Unifică selectate</button>
                  </div>
                </div>
              </form>
            );
          })}
        </div>
      )}
    </div>
  );
}
