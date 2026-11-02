'use client';
import Link from 'next/link';
import {useTransition} from 'react';
export function PageError({reset,publicPage=false}:{reset:()=>void;publicPage?:boolean}){
 const [pending,start]=useTransition();
 return <section className="card page-recovery" role="alert"><h2>Pagina nu a putut fi încărcată</h2><p>Conexiunea poate fi întreruptă sau datele nu sunt disponibile momentan. Dacă tocmai ai salvat ceva, verifică rezultatul înainte să repeți acțiunea.</p><div className="inline-form"><button type="button" className="btn" disabled={pending} onClick={()=>start(reset)}>{pending?'Se reîncearcă…':'Încearcă din nou'}</button><Link className="btn secondary" href={publicPage?'/login':'/dashboard'}>{publicPage?'Programe publice':'Acasă'}</Link></div></section>;
}
