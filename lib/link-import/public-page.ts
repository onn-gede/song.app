import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
export function isPublicAddress(value: string) {
  const ip=value.replace(/^\[|\]$/g,"");
  if(isIP(ip)===4){
    const [a,b,c]=ip.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||(b===88&&c===99)))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
  }
  if(isIP(ip)===6){const normalized=new URL(`http://[${ip}]/`).hostname.slice(1,-1);return /^[23]/i.test(normalized)&&!/^2001:(?::|0:|db8:|10:|20:)/i.test(normalized)&&!/^2002:|^3fff:/i.test(normalized);}
  return false;
}
export function validatePublicUrl(value: string) {
  let url:URL;try{url=new URL(value.trim());}catch{throw new Error("Introdu un link complet HTTP sau HTTPS.");}
  const host=url.hostname.replace(/^\[|\]$/g,"");
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port||url.href.length>2000||!host.includes('.')&&!isIP(host)||/^(localhost)$/i.test(host)||/\.(local|localhost|internal|lan|home)$/i.test(host)||(isIP(host)&&!isPublicAddress(host)))throw new Error("Folosește adresa publică a unei pagini de cântare.");
  return url;
}
export async function resolvePublicAddress(hostname: string, resolver = lookup) {
  const host=hostname.replace(/^\[|\]$/g,"");
  const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await resolver(host,{all:true,verbatim:true});
  if(!addresses.length||addresses.some(item=>!isPublicAddress(item.address)))throw new Error("Adresa sursei nu este publică.");
  return addresses.find(item=>item.family===4)||addresses[0];
}
export type PublicPage = {status:number;location?:string;contentType:string;html:string};
export async function fetchPublicPage(value: string):Promise<PublicPage> {
  const url=validatePublicUrl(value);
  const address=await resolvePublicAddress(url.hostname);
  // Pin the validated DNS result to this connection; a second DNS lookup cannot rebind it.
  return new Promise((resolve,reject)=>{
    const transport=url.protocol==='https:'?httpsRequest:httpRequest;
    const req=transport(url,{
      family:address.family,
      lookup:((_hostname:unknown,options:any,callback:any)=>{if(options?.all)callback(null,[address]);else callback(null,address.address,address.family);}) as any,
      signal:AbortSignal.timeout(15000),headers:{accept:'text/html,application/xhtml+xml','accept-encoding':'identity','user-agent':'SongApp BCBgiroc/0.5 link-preview'}
    },res=>{
      const status=res.statusCode||500,contentType=String(res.headers['content-type']||'');
      if(status>=300&&status<400){res.resume();resolve({status,contentType,location:res.headers.location,html:''});return;}
      if(status!==200){res.resume();resolve({status,contentType,html:''});return;}
      if(!/text\/html|application\/xhtml\+xml/i.test(contentType)){res.resume();resolve({status,contentType,html:''});return;}
      const chunks:Buffer[]=[];let bytes=0;
      res.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>2*1024*1024){res.destroy();reject(new Error('Pagina este prea mare pentru preview.'));}else chunks.push(chunk);});
      res.on('error',reject);
      res.on('end',()=>{try{
        let body=Buffer.concat(chunks);const encoding=res.headers['content-encoding'];const options={maxOutputLength:2*1024*1024};
        if(encoding==='gzip')body=gunzipSync(body,options);else if(encoding==='br')body=brotliDecompressSync(body,options);else if(encoding==='deflate')body=inflateSync(body,options);
        resolve({status,contentType,html:body.toString('utf8')});
      }catch{reject(new Error('Pagina nu poate fi decodată.'));}});
    });req.on('error',reject);req.end();
  });
}
