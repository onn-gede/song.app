// Meeting wall-clock values always mean Europe/Bucharest, on local and hosted servers alike.
const formatter = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function bucharestInput(date=new Date()) {
 const parts=Object.fromEntries(formatter.formatToParts(date).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function meetingDateISO(value:string) {
 if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)){
  const date=new Date(value);if(!Number.isFinite(date.getTime()))throw new Error('Data nu este validă.');return date.toISOString();
 }
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Alege data și ora programului.');
 const utc=Date.parse(value+'Z');if(!Number.isFinite(utc))throw new Error('Data nu este validă.');
 // Try both Romanian UTC offsets; round-trip rejects impossible dates and the DST gap.
 for(const offset of [180,120]){const date=new Date(utc-offset*60000);if(bucharestInput(date)===value)return date.toISOString();}
 throw new Error('Ora aleasă nu există în calendarul României. Alege o altă oră.');
}
