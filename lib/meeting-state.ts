export type ProgramItem = {
  id: string; position: number; item_type: string; song_id: string | null;
  custom_title: string | null; custom_text: string | null; selected_key: string | null;
  selected_bpm: number | null; is_backup: boolean; notes: string | null;
  responsible_name?: string | null;
  songs: { id: string; title: string; lyrics_text: string | null; default_key: string | null; bpm: number | null; structure: string | null } | null;
};
export type MeetingSnapshot = {
  revision: number; principal: string | null; secondary: string[]; items: ProgramItem[];
};
// A delayed route response must never overwrite a newer committed action result.
export function latestMeetingSnapshot(initial: MeetingSnapshot, committed: MeetingSnapshot | null) {
  return committed && committed.revision >= initial.revision ? committed : initial;
}
export function bucharestDay(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export function meetingStatus(date: string, status: string, template = false, now = new Date()) {
  if (template) return 'template';
  if (status === 'archived') return 'archived';
  return bucharestDay(date) < bucharestDay(now) ? 'finished' : status;
}

// UTC instant for midnight in Bucharest, including winter/summer offset.
export function bucharestDayStart(now: Date) {
  const day = bucharestDay(now);
  const midnight = new Date(`${day}T00:00:00Z`);
  const localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', hourCycle: 'h23' }).format(midnight));
  return new Date(Date.parse(`${day}T00:00:00Z`) - localHour * 3600000).toISOString();
}
