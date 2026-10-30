import Link from 'next/link';
import {createPublicClient} from '@/lib/supabase/public';
import {formatDateTime} from '@/lib/format';
export async function NextPublicProgram(){const db=createPublicClient();const {data,error}=await db.rpc('next_public_program_v65');return <section className="card guest-program"><div className="eyebrow">Acces vizitator</div><h2>Programul public al echipei</h2>{error?<p>Programul public nu poate fi încărcat momentan.</p>:data?<><h3>{data.title}</h3><p>{formatDateTime(data.date)}</p><Link className="btn public-highlight" href={`/program/${data.slug}`}>Deschide programul</Link></>:<p>Nu este disponibil încă un program public pentru o întâlnire viitoare sau în curs.</p>}</section>;}
