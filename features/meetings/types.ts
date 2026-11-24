import type { CollectionSource } from "@/lib/collection-colors";
import type { SongScheduleSummary } from "@/lib/song-schedule";

export type MeetingOption = {
  id: string;
  title: string;
  meeting_date: string;
  status: string;
  is_template?: boolean;
  program_kind?: "official" | "rehearsal";
};

export type SongSearchResult = {
  verse_count?: number | null;
  first_verse?: string | null;
  chorus?: string | null;
  song_id: string;
  title: string;
  default_key: string | null;
  bpm: number | null;
  rank?: number;
  matched_source: string | null;
  sources?: CollectionSource[];
  schedule?: SongScheduleSummary;
};

export type RecentUsage = {
  song_id: string;
  title: string;
  last_used_at: string;
  times_used: number;
  last_meeting_title: string | null;
};
