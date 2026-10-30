import {UsageRefresh} from "@/components/UsageRefresh";
import { redirect } from "next/navigation";
import { LibraryPagination } from "@/components/LibraryPagination";
import Link from "next/link";
import { LibraryToolbar } from "@/components/LibraryToolbar";
import { SongsBulkList } from "@/components/SongsBulkList";
import { Icon } from "@/components/Icon";
import { requireProfile,canEdit } from "@/lib/auth";
import { PAGE_SIZE,libraryPage,libraryHref,type LibraryFilters } from "@/lib/library";
export default async function SongsPage({searchParams}:{searchParams?:Promise<LibraryFilters>}) {
 const params=(await searchParams)||{},page=libraryPage(params.page);
 const {supabase,profile}=await requireProfile();const editable=canEdit(profile.role);
 const [{data:collections},{data:categories},{data:result,error}]=await Promise.all([
  supabase.from("song_collections").select("id,name,short_code,color,opacity,is_active").order("name"),
  supabase.from("categories").select("id,name,slug").order("name"),
  supabase.rpc("list_song_library_v46",{p_collection:params.collection||null,p_category:params.category||null,p_number:params.number||null,p_status:params.status||null,p_key:params.key||null,p_sort:params.sort||"title_asc",p_page:page,p_page_size:PAGE_SIZE,p_query:params.q||null})
 ]);
 const songs=result?.songs||[],total=Number(result?.total||0),pageCount=Math.max(1,Math.ceil(total/PAGE_SIZE));
 if(!error&&page>pageCount)redirect(libraryHref(params,pageCount));
 return <div className="library-page-v44"><UsageRefresh/><div className="page-heading-v44"><div><div className="eyebrow">Biblioteca ta de muzică</div><h1>Cântări<span className="heading-count">{total.toLocaleString("ro-RO")}</span></h1><p>Găsește cântarea potrivită pentru următorul program.</p></div>{editable?<Link className="btn" href="/import"><Icon name="plus" size={18}/>Importă o cântare</Link>:null}</div>
  <LibraryToolbar collections={(collections||[]).filter(c=>c.is_active)} categories={categories||[]} keys={result?.keys||[]}/>
  {params.q&&(params.collection||params.category||params.key||params.number||params.status||['most_sung','last_sung'].includes(params.sort||''))?<Link className="text-link-v44" href={libraryHref({q:params.q},1)}>Caută „{params.q}” în toate cântările și colecțiile</Link>:null}
  <div className="library-quick-sorts" aria-label="Ordonări rapide">{[['created_desc','Adăugate recent'],['last_sung','Cântate recent în programe'],['most_sung','Cele mai des cântate']].map(([sort,label])=><Link key={sort} className={'btn '+(params.sort===sort?'':'secondary')} aria-current={params.sort===sort?'page':undefined} href={libraryHref({...params,sort},1)}>{label}</Link>)}</div>
  {params.deleted?<p className="success" role="status">Au fost șterse {params.deleted} cântări.</p>:null}
  {error?<p className="error" role="alert">{error.message.includes("list_song_library_v46")?"Rulează UPDATE-V46.sql în baza existentă pentru noua căutare și filtrare.":"Biblioteca nu poate fi încărcată momentan. Încearcă din nou."}</p>:<section className="library-results-v44" aria-label="Lista cântărilor"><div className="library-results-heading"><span>{params.q?`Rezultate pentru „${params.q}”`:({most_sung:"Cele mai des cântate",last_sung:"Cântate recent în programe",created_desc:"Cele mai recente cântări adăugate"} as Record<string,string>)[params.sort||""]||"Biblioteca de cântări"}</span><small role="status">{total?`${(page-1)*PAGE_SIZE+1}–${Math.min(page*PAGE_SIZE,total)} din ${total.toLocaleString("ro-RO")}`:"Niciun rezultat"}</small></div>
   <LibraryPagination position="top" filters={params} page={page} pages={pageCount}/><SongsBulkList key={`${page}:${JSON.stringify(params)}`} songs={songs} categories={categories||[]} collections={collections||[]} canManage={editable}/>
   <LibraryPagination filters={params} page={page} pages={pageCount}/>
  </section>}
 </div>;
}
