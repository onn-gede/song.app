import {requestJson} from './client-request';
import type {MeetingSnapshot} from './meeting-state';
export async function addProgramSong(input:{meetingId:string;songId:string;sourceId?:string|null;isBackup:boolean;selectedKey?:string|null;requestId:string}):Promise<MeetingSnapshot>{
 const data=await requestJson<{itemId:string;snapshot:MeetingSnapshot}>(`/api/meetings/${input.meetingId}/live`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add',...input})});
 const item=data.snapshot?.items?.find(x=>x.id===data.itemId&&x.song_id===input.songId&&x.is_backup===input.isBackup);
 if(!data.itemId||!item)throw Error('Nu am putut confirma adăugarea. Reîncearcă.');
 if(input.selectedKey?.trim()&&item.selected_key?.trim()!==input.selectedKey.trim())throw Error('Cântarea a fost adăugată, dar tonalitatea nu a fost confirmată. Deschide elementul și salveaz-o din nou.');
 try{const channel=new BroadcastChannel('songapp-programs');channel.postMessage({meetingId:input.meetingId});channel.close();localStorage.setItem('songapp:program-updated',JSON.stringify({meetingId:input.meetingId,at:Date.now()}));}catch{}
 return data.snapshot;
}
