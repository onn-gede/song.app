import type {MeetingSnapshot} from './meeting-state';
export async function addProgramSong(input:{meetingId:string;songId:string;sourceId?:string|null;isBackup:boolean;selectedKey?:string|null;requestId:string}):Promise<MeetingSnapshot>{
 const response=await fetch(`/api/meetings/${input.meetingId}/live`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add',...input})});const data=await response.json();if(!response.ok)throw Error(data.error||'Adăugarea a eșuat.');
 if(!data.itemId||!data.snapshot?.items?.some((x:any)=>x.id===data.itemId&&x.song_id===input.songId&&x.is_backup===input.isBackup))throw Error('Nu am putut confirma adăugarea. Reîncearcă.');
 try{const channel=new BroadcastChannel('songapp-programs');channel.postMessage({meetingId:input.meetingId});channel.close();localStorage.setItem('songapp:program-updated',JSON.stringify({meetingId:input.meetingId,at:Date.now()}));}catch{}
 return data.snapshot;
}
