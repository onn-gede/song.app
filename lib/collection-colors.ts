import type {CSSProperties} from 'react';
export type CollectionSource={source_id:string;collection_id:string;name:string;short_code?:string|null;color:string;number:string|null;opacity?:number;is_active?:boolean};
export const COLLECTION_PALETTE=['#9f1239','#1d4ed8','#047857','#7e22ce','#b45309','#0e7490','#be123c','#4338ca','#4d7c0f','#a21caf','#334155','#92400e'];
export function primarySource(sources:CollectionSource[]=[],id?:string|null,collectionId?:string|null){return sources.find(s=>s.source_id===id)||sources.find(s=>s.collection_id===collectionId)||sources.find(s=>s.is_active!==false)||sources[0]||null;}
export function validCollectionColor(value?:string|null){return !!value&&/^#[0-9a-f]{6}$/i.test(value);}
function luminance(color:string){return [1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);}
export function collectionStyle(source?:{color?:string|null;opacity?:number|null}|null):CSSProperties{
 const color=validCollectionColor(source?.color)?source!.color!:'#64748b';let ink=color;
 // Preserve the collection hue while keeping title/number text readable on white.
 for(let i=0;(1.05/(luminance(ink)+.05))<4.5&&i<12;i++)ink='#'+[1,3,5].map(at=>Math.floor(parseInt(ink.slice(at,at+2),16)*.8).toString(16).padStart(2,'0')).join('');
 const opacity=[25,50,75,100].includes(source?.opacity||100)?(source?.opacity||100):100;const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));const mixed=rgb.map(v=>(v*opacity/100+255*(1-opacity/100))/255);const lum=mixed.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 return {'--collection-tag-bg':`rgba(${rgb.join(',')},${opacity/100})`,'--collection-color':color,'--collection-ink':ink,'--collection-tag-ink':lum>.179?'#172b22':'#ffffff'} as CSSProperties;
}
