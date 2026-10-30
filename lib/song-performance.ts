export function normalizePerformanceStructure(value:string|null|undefined){
 const pattern=String(value||'').toUpperCase().replace(/\s+/g,'');
 if(pattern&&(!/^(S\d*|R\d*|B\d*)(,(S\d*|R\d*|B\d*))*$/.test(pattern)||pattern.length>300))throw Error('Structură invalidă. Exemplu: S1,R,S2,R,B,R.');
 return pattern;
}
export function arrangeSections<T extends {section_type:string}>(sections:T[],pattern:string|null|undefined):T[]{
 if(!pattern)return sections;
 const cursors:Record<string,number>={S:0,R:0,B:0},types:Record<string,string>={S:'verse',R:'chorus',B:'bridge'};
 const tokens=normalizePerformanceStructure(pattern).split(',');
 // Incomplete source data must never turn an existing song into an empty presentation.
 const output:T[]=[];
 for(const token of tokens){const kind=token[0],group=sections.filter(s=>s.section_type===types[kind]);if(!group.length)return sections;const explicit=token.slice(1);const index=explicit?Number(explicit)-1:kind==='S'?cursors.S++%group.length:0;if(index<0||index>=group.length)return sections;output.push(group[index]);}
 return output;
}
export function changedProgramIds(previous:Record<string,string>|null,next:Record<string,string>){return previous?Object.keys(next).filter(id=>previous[id]!==next[id]):[];}
