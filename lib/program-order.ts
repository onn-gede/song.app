import type {ProgramItem} from './meeting-state';
export function reorderedProgram(items:ProgramItem[],id:string,backup:boolean,before:string|null){
 const item=items.find(i=>i.id===id);if(!item||id===before)return items;
 const rest=items.filter(i=>i.id!==id),main=rest.filter(i=>!i.is_backup).sort((a,b)=>a.position-b.position),reserve=rest.filter(i=>i.is_backup).sort((a,b)=>a.position-b.position);
 const group=backup?reserve:main,at=group.findIndex(i=>i.id===before);group.splice(at<0?group.length:at,0,{...item,is_backup:backup});
 return [...main,...reserve].map((i,index)=>({...i,position:index+1}));
}
