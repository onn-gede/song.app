"use client";
import Link from "next/link";
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="card" role="alert"><h1>Pagina nu s-a putut încărca</h1><p className="muted">Verifică conexiunea și încearcă din nou.</p><div className="inline-form"><button className="btn" onClick={reset}>Reîncearcă</button><Link className="btn secondary" href="/dashboard">Acasă</Link></div></section>;
}
