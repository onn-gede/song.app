import { createServerClient } from "@supabase/ssr";
import { NextResponse,type NextRequest } from "next/server";
export async function updateSession(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(path.startsWith('/_next/')||path==='/favicon.ico'||path.startsWith('/api/public-program/'))return NextResponse.next();
 let response=NextResponse.next({request});
 const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll(){return request.cookies.getAll();},setAll(cookies){cookies.forEach(c=>request.cookies.set(c.name,c.value));response=NextResponse.next({request});cookies.forEach(c=>response.cookies.set(c.name,c.value,c.options));}}});
 const prefetch=request.headers.has('next-router-prefetch')||request.headers.get('purpose')==='prefetch';
 if(path.startsWith('/program/')){
   if(request.method==='GET'&&!prefetch){const slug=decodeURIComponent(path.split('/')[2]||'');if(slug&&slug.length<201){const {error}=await supabase.rpc('record_public_view_v48',{p_slug:slug,p_event:'public.view'});if(error)console.warn('Public access audit unavailable');}}
   return response;
 }
 if(path==='/login')return response;
 let user;try{const result=await supabase.auth.getUser();user=result.data.user;}catch{}
 if(!user){if(path.startsWith('/api/'))return NextResponse.json({error:'Autentificare necesară.'},{status:401});return NextResponse.redirect(new URL('/login',request.url));}
 if(prefetch)return response;
 // The RPC verifies an active profile and records access in one database round trip.
 const {error}=await supabase.rpc('record_activity_v48',{p_event:request.method==='GET'?'request.view':'request.action',p_path:path,p_details:{query:path==='/songs'?request.nextUrl.searchParams.get('q'):null}});
 if(error){
  if(error.code==='42501')return path.startsWith('/api/')?NextResponse.json({error:'Acces inactiv.'},{status:403}):NextResponse.redirect(new URL('/login?inactive=1',request.url));
  return new NextResponse('Acces temporar indisponibil. Administrator: verifică jurnalul și aplicarea UPDATE-V48.sql.',{status:503});
 }
 return response;
}
