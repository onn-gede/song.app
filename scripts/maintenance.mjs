import fs from 'node:fs';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;
if(!url||!key){if(!url)console.error('Lipsește SUPABASE_URL: GitHub repository → Settings → Secrets and variables → Actions → Variables → New repository variable.');if(!key)console.error('Lipsește SUPABASE_ANON_KEY: GitHub repository → Settings → Secrets and variables → Actions → Secrets → New repository secret.');process.exit(1);}
const target=new URL(url);if(target.protocol!=='https:'||!target.hostname.endsWith('.supabase.co'))throw new Error('SUPABASE_URL trebuie să fie proiectul Supabase HTTPS.');
// Small real database health checks. They do not read songs or create deployments.
for(let i=0;i<3;i++){
 const response=await fetch(new URL('/rest/v1/rpc/songapp_health_v48',target),{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});
 if(!response.ok||await response.json()!==true)throw new Error('Verificarea Supabase a eșuat. Verifică proiectul și UPDATE-V48.sql.');
}
const file='ops/heartbeat.json',now=new Date();let previous;try{previous=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
if(!previous?.checked_at||now.getTime()-Date.parse(previous.checked_at)>=47*3600000){fs.mkdirSync('ops',{recursive:true});fs.writeFileSync(file,JSON.stringify({checked_at:now.toISOString(),status:'healthy'},null,2)+'\n');}
console.log('Verificare de funcționare reușită.');
