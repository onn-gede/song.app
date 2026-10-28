import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchHtml, extractLinks, parseResurseSong } from "./parser";
import { stripRepeatedSongTitleLines } from "../songTextCleanup";

type Job = {
  id: string; lease_token: string; pages_scanned: number; found_count: number;
  next_index: number; discovered_links: Array<{ url: string }>;
  options: { pages: number; maxSongs: number; overwrite: boolean };
};
type Network = { fetchHtml: typeof fetchHtml };

// Exactly one page/song per claim. All state and song writes commit together in
// PostgreSQL; a terminated process resumes after its 90-second lease expires.
export async function processNextSyncUnit(client: SupabaseClient, network: Network = { fetchHtml }) {
  const call = async (name: string, args = {}) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  };
  const job = await call("claim_external_sync") as Job | null;
  if (!job) return false;
  const fence = { p_run_id: job.id, p_token: job.lease_token };
  try {
    if (job.pages_scanned < job.options.pages) {
      const page = job.pages_scanned + 1;
      const base = "https://www.resursecrestine.ro";
      const html = await network.fetchHtml(`${base}/cantece/index-ultimele${page > 1 ? `/${page}` : ""}`);
      await call("checkpoint_external_scan", { ...fence, p_page: page, p_links: extractLinks(html, base, "resursecrestine") });
    } else if (job.next_index >= job.found_count) {
      await call("commit_external_sync_song", fence);
    } else {
      let song = null;
      let failure: string | null = null;
      try {
        const link = job.discovered_links[job.next_index];
        const parsed = parseResurseSong(await network.fetchHtml(link.url), link.url);
        if (!parsed) throw new Error("Nu s-au identificat versuri valide în pagina sursă.");
        const sections = parsed.sections.map((section, index) => ({ ...section, position: index + 1,
          content: stripRepeatedSongTitleLines(section.content, parsed.title)
        })).filter((section) => section.content.length > 0);
        const lyrics = sections.length ? sections.map((section) => `${section.section_label || "Strofă"}\n${section.content}`).join("\n\n") : stripRepeatedSongTitleLines(parsed.lyrics, parsed.title);
        song = { title: parsed.title, lyrics, sections, hash: crypto.createHash("sha256").update(parsed.title + "\n" + lyrics).digest("hex") };
      } catch (error) {
        failure = error instanceof Error ? error.message : "Eroare la citirea cântării.";
      }
      // Database errors must not be turned into skipped songs. A failed commit
      // fails this run, preserving its cursor and already imported songs.
      await call("commit_external_sync_song", { ...fence, p_song: song, p_error: failure });
    }
  } catch (error) {
    await call("fail_external_sync", { ...fence, p_error: error instanceof Error ? error.message : String(error) });
  }
  return true;
}
