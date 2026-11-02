/** JSON transport for interactive requests. Never retries a mutation automatically. */
export async function requestJson<T>(url:string,init:RequestInit={},timeoutMs=20000):Promise<T>{
 const controller=new AbortController();let timedOut=false;
 const abort=()=>controller.abort();init.signal?.addEventListener('abort',abort,{once:true});
 if(init.signal?.aborted)abort();
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
 const mutation=!!init.method&&!['GET','HEAD'].includes(init.method.toUpperCase());
 try{
  const response=await fetch(url,{...init,signal:controller.signal});
  if(response.status===401||response.redirected&&new URL(response.url,'http://localhost').pathname==='/login')throw Error('Sesiunea a expirat. Autentifică-te din nou înainte să continui.');
  if(response.status===403)throw Error('Nu ai permisiunea pentru această operațiune.');
  if(response.status===429)throw Error('Prea multe cereri. Așteaptă puțin și încearcă din nou.');
  let data:unknown;try{data=await response.json();}catch{throw Error(mutation?'Serverul nu a confirmat salvarea. Verifică programul înainte să repeți acțiunea.':'Serverul nu a răspuns corect. Încearcă din nou.');}
  if(!response.ok){const message=data&&typeof data==='object'&&'error' in data?String(data.error):'';throw Error(message&&message.length<500?message:'Cererea nu a putut fi finalizată.');}
  return data as T;
 }catch(error){
  if(init.signal?.aborted)throw error;
  if(timedOut||error instanceof TypeError)throw Error(mutation?'Conexiunea a fost întreruptă sau salvarea durează prea mult. Verifică programul înainte să repeți acțiunea.':'Conexiunea nu este disponibilă sau cererea durează prea mult. Încearcă din nou.');
  throw error;
 }finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort);}
}
