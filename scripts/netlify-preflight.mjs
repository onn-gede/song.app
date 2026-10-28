const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SITE_URL'];
const missing=required.filter(name=>!process.env[name]?.trim());
if(missing.length){console.error('Configurează în Netlify variabilele: '+missing.join(', '));process.exit(1);}
const site=new URL(process.env.NEXT_PUBLIC_SITE_URL);
if(site.protocol!=='https:'||['localhost','127.0.0.1'].includes(site.hostname)){console.error('NEXT_PUBLIC_SITE_URL trebuie să fie URL-ul HTTPS public al proiectului Netlify.');process.exit(1);}
console.log('Configurația Netlify este completă. Valorile private nu sunt afișate.');
