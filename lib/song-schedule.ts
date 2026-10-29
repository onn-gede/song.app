export type SongProgramEvent={meeting_id:string;meeting_title:string;meeting_date:string;is_backup:boolean;phase:'planned'|'in_progress'|'finished';day?:string};
export type SongScheduleSummary={next:SongProgramEvent|null;last:SongProgramEvent|null};
export type SongScheduleMonth={month:string;events:SongProgramEvent[];past_count:number;planned_count:number;previous_month:string|null;next_month:string|null};
export function scheduleEventLabel(event:SongProgramEvent){return event.phase==='planned'?'Cântare propusă pentru':event.phase==='in_progress'?'În programul în curs din':event.is_backup?'Rezervă în programul din':'Cântare cântată în';}
export function eventDateTime(value:string){return new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)).replace(',',' ·');}
export function monthOf(value:string){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}`;}
