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
  supabase.from("song_collections").select("id,name,short_code").eq("is_active",true).order("name"),
  supabase.from("categories").select("id,name,slug").order("name"),
  supabase.rpc("list_song_library_v46",{p_collection:params.collection||null,p_category:params.category||null,p_number:params.number||null,p_status:params.status||null,p_key:params.key||null,p_sort:params.sort||"title_asc",p_page:page,p_page_size:PAGE_SIZE,p_query:params.q||null})
 ]);
 const songs=result?.songs||[],total=Number(result?.total||0),pageCount=Math.max(1,Math.ceil(total/PAGE_SIZE));
 return <div className="library-page-v44"><div className="page-heading-v44"><div><div className="eyebrow">Biblioteca ta de muzică</div><h1>Cântări<span className="heading-count">{total.toLocaleString("ro-RO")}</span></h1><p>Găsește cântarea potrivită pentru următorul program.</p></div>{editable?<Link className="btn" href="/import"><Icon name="plus" size={18}/>Importă o cântare</Link>:null}</div>
  <LibraryToolbar collections={collections||[]} categories={categories||[]} keys={result?.keys||[]}/>
  {params.deleted?<p className="success" role="status">Au fost șterse {params.deleted} cântări.</p>:null}
  {error?<p className="error" role="alert">{error.message.includes("list_song_library_v46")?"Rulează UPDATE-V46.sql în baza existentă pentru noua căutare și filtrare.":"Biblioteca nu poate fi încărcată momentan. Încearcă din nou."}</p>:<section className="library-results-v44" aria-label="Lista cântărilor"><div className="library-results-heading"><span>{params.q?`Rezultate pentru „${params.q}”`:params.sort==="most_sung"?"Cele mai cântate cântări":"Biblioteca de cântări"}</span><small role="status">{total?`${(page-1)*PAGE_SIZE+1}–${Math.min(page*PAGE_SIZE,total)} din ${total.toLocaleString("ro-RO")}`:"Niciun rezultat"}</small></div>
   <SongsBulkList key={`${page}:${JSON.stringify(params)}`} songs={songs} canManage={editable}/>
   <nav className="library-pagination" aria-label="Paginare cântări">{page>1?<Link className="btn secondary" href={libraryHref(params,Math.min(page-1,pageCount))}>← Înapoi</Link>:<span/>}<span>Pagina <strong>{page}</strong> din {pageCount}</span>{page<pageCount?<Link className="btn secondary" href={libraryHref(params,page+1)}>Înainte →</Link>:page>pageCount?<Link className="btn secondary" href={libraryHref(params,1)}>Prima pagină</Link>:<span/>}</nav>
  </section>}
 </div>;
}
