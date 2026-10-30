import {type CookieOptions,createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {invalidRefreshSession,sessionCookieNames} from '@/lib/auth-session';
export async function updateSession(request:NextRequest){
 const path=request.nextUrl.pathname;
 // These handlers validate JWT/role themselves and can persist their own cookies.
 if(/^\/api\/meetings\/[0-9a-f-]{36}\/live$/i.test(path)&&['GET','PATCH'].includes(request.method))return NextResponse.next();
 if(path==='/pdf.worker-5.4.296.min.mjs'||path==='/notifications-sw.js')return NextResponse.next();
 if((path==='/api/songs/search'||/^\/api\/songs\/[0-9a-f-]{36}\/schedule$/i.test(path))&&request.method==='GET')return NextResponse.next();
 if(path.startsWith('/_next/')||path==='/favicon.ico'||path.startsWith('/api/public-program/'))return NextResponse.next();
 let response=NextResponse.next({request});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,pending=new Map<string,{name:string;value:string;options?:CookieOptions}>();
 function applyCookies(){response=NextResponse.next({request});for(const cookie of pending.values())response.cookies.set(cookie.name,cookie.value,cookie.options);}
 function finish(result:NextResponse=response){if(result!==response)for(const cookie of pending.values())result.cookies.set(cookie.name,cookie.value,cookie.options);if(pending.size)result.headers.set('Cache-Control','private, no-store');return result;}
 const originalCookies=sessionCookieNames(request.cookies.getAll(),url);
 const supabase=createServerClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store'})},cookies:{getAll(){return request.cookies.getAll();},setAll(cookies){for(const c of cookies){request.cookies.set(c.name,c.value);pending.set(c.name,c);}applyCookies();}}});
 // Refresh before any public/private rendering. Server Components cannot clear stale cookies.
 let user;let authError:unknown;
 try{const result=await supabase.auth.getUser();user=result.data.user;authError=result.error;}catch(error){authError=error;}
 if(invalidRefreshSession(authError)){
  for(const name of originalCookies){request.cookies.delete(name);pending.set(name,{name,value:'',options:{path:'/',maxAge:0}});}applyCookies();user=null;
 }
 const prefetch=request.headers.has('next-router-prefetch')||request.headers.get('purpose')==='prefetch';
 if(path.startsWith('/program/')){
  if(request.method==='GET'&&!prefetch){let slug='';try{slug=decodeURIComponent(path.split('/')[2]||'');}catch{}if(slug&&slug.length<201){const {error}=await supabase.rpc('record_public_view_v48',{p_slug:slug,p_event:'public.view'});if(error)console.warn('Public access audit unavailable');}}
  return finish();
 }
 if(path==='/login'||path==='/'||path==='/vizitator')return finish();
 if(!user)return finish(path.startsWith('/api/')?NextResponse.json({error:'Autentificare necesară.'},{status:401}):NextResponse.redirect(new URL('/login',request.url)));
 if(prefetch)return finish();
 const {error}=await supabase.rpc('record_activity_v48',{p_event:request.method==='GET'?'request.view':'request.action',p_path:path,p_details:{query:path==='/songs'?request.nextUrl.searchParams.get('q'):null}});
 if(error){if(error.code==='42501')return finish(path.startsWith('/api/')?NextResponse.json({error:'Acces inactiv.'},{status:403}):NextResponse.redirect(new URL('/login?inactive=1',request.url)));return finish(new NextResponse('Acces temporar indisponibil. Administrator: verifică jurnalul și aplicarea UPDATE-V48.sql.',{status:503}));}
 return finish();
}
