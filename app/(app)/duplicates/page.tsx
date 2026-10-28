import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { DuplicateMergeList, type DuplicateGroup } from "@/components/DuplicateMergeList";
export default async function DuplicatesPage({searchParams}:{searchParams?:Promise<{limit?:string}>}){
 const {supabase}=await requireProfile("editor");const params=await searchParams;const limit=Math.min(200,Math.max(10,Number(params?.limit)||50));
 const {data,error}=await supabase.rpc("find_duplicate_song_candidates",{p_limit:limit});const groups=(data||[]) as DuplicateGroup[];
 return <div><div className="page-heading-v44"><div><div className="eyebrow">Organizare bibliotecă</div><h1>Duplicate cântări</h1><p>{groups.length} grupuri afișate. Alege varianta principală și unifică unul sau mai multe grupuri.</p></div><Link className="btn secondary" href="/songs">Înapoi la cântări</Link></div>
 <form action="/duplicates" className="inline-form"><label>Grupuri afișate <select className="select" name="limit" defaultValue={limit}><option>25</option><option>50</option><option>100</option><option>200</option></select></label><button className="btn secondary">Afișează</button></form>
 {error?<p className="error">{error.message}</p>:<DuplicateMergeList key={JSON.stringify(groups.map(g=>g.group_key))} groups={groups}/>}
 </div>;
}
