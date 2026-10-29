export function presentationFileIdentity(name:string){
 const fileName=name.split(/[\\/]/).pop()||'';const match=fileName.match(/^\s*(\d{1,4})[\s._-]+(.+)\.(pptx?|pdf)$/i);
 if(!match||Number(match[1])<1)return null;
 return {number:String(Number(match[1])).padStart(3,'0'),title:match[2].trim(),fileName,extension:match[3].toLowerCase()};
}
export async function presentationDigest(bytes:Uint8Array){const data=new Uint8Array(bytes);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data.buffer))).map(v=>v.toString(16).padStart(2,'0')).join('');}
