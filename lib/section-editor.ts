export type StructuredSongSection={section_type:string;section_label:string;position:number;content:string};

export const sectionTypeOptions=[
  ["verse","Strofă"],["chorus","Refren"],["bridge","Bridge"],["prechorus","Pre-refren"],["ending","Final"],["text","Text"]
] as const;

export function defaultSectionLabel(type:string,verseNumber=1){
  return type==="verse"?`Strofa ${verseNumber}`:({chorus:"Refren",bridge:"Bridge",prechorus:"Pre-refren",ending:"Final",text:"Text"} as Record<string,string>)[type]||"Strofa";
}

export function structureFromSections(sections:Array<Pick<StructuredSongSection,"section_type">&Partial<Pick<StructuredSongSection,"section_label">>>){
  let verse=0;
  return sections.map(section=>{if(section.section_type!=="verse")return ({chorus:"R",bridge:"B",prechorus:"PR",ending:"F",text:"T"} as Record<string,string>)[section.section_type]||"S";const labelNumber=Number(section.section_label?.match(/\d+/)?.[0]);if(Number.isFinite(labelNumber)&&labelNumber>0){verse=Math.max(verse,labelNumber);return `S${labelNumber}`;}return `S${++verse}`;}).join(", ");
}

export function lyricsFromStructuredSections(sections:Pick<StructuredSongSection,"content">[]){
  return sections.map(section=>section.content.replace(/\r\n?/g,"\n").trim()).filter(Boolean).join("\n\n");
}

export function splitSectionText(value:string){
  return value.replace(/\r\n?/g,"\n").split(/\n[ \t]*\n+/).map(chunk=>chunk.trim()).filter(Boolean);
}

export function normalizeStructuredSections(sections:StructuredSongSection[]){
  let verse=0;
  return sections.map((section,index)=>({
    section_type:section.section_type,
    section_label:section.section_type==="verse"?(section.section_label||defaultSectionLabel("verse",++verse)):section.section_label||defaultSectionLabel(section.section_type),
    position:index+1,
    content:section.content.replace(/\r\n?/g,"\n").trim()
  }));
}
