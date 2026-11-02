import {requestJson} from './client-request';
import type {MeetingSnapshot} from './meeting-state';
export async function addProgramSong(input:{meetingId:string;songId:string;sourceId?:string|null;isBackup:boolean;selectedKey?:string|null;requestId:string}):Promise<MeetingSnapshot>{
 const data=await requestJson<{itemId:string;snapshot:MeetingSnapshot}>(`/api/meetings/${input.meetingId}/live`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add',...input})});
 if(!data.itemId||!data.snapshot?.items?.some(x=>x.id===data.itemId&&x.song_id===input.songId&&x.is_backup===input.isBackup))throw Error('Nu am putut confirma adăugarea. Reîncearcă.');
 try{const channel=new BroadcastChannel('songapp-programs');channel.postMessage({meetingId:input.meetingId});channel.close();localStorage.setItem('songapp:program-updated',JSON.stringify({meetingId:input.meetingId,at:Date.now()}));}catch{}
 return data.snapshot;
}
