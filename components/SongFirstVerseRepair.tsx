import { repairSingleYouthLyricAction } from "@/features/songs/server/actions";

export type FirstVerseCandidate = {
  id: string;
  title: string;
  number?: string | null;
  before: string;
  after: string;
  hash: string;
};

export function SongFirstVerseRepair({ candidate }: { candidate?: FirstVerseCandidate | null }) {
  if (!candidate) return null;
  return (
    <details className="song-first-verse-repair card-soft print-hide">
      <summary>
        <span aria-hidden="true">✦</span> Corectează primul vers lipsă
      </summary>
      <p className="small">
        Titlul pare să fie primul vers care lipsește din prima strofă. Verifică preview-ul înainte de
        corectare.
      </p>
      <div className="first-verse-preview">
        <div>
          <strong>Acum</strong>
          <pre>{candidate.before}</pre>
        </div>
        <div>
          <strong>După corectare</strong>
          <pre>{candidate.after}</pre>
        </div>
      </div>
      <form action={repairSingleYouthLyricAction}>
        <input type="hidden" name="song_id" value={candidate.id} />
        <input type="hidden" name="candidate_hash" value={candidate.hash} />
        <button className="btn btn-compact" type="submit">
          Aplică această corectare
        </button>
      </form>
    </details>
  );
}
