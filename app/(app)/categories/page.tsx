import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createCategoryAction, deleteCategoryAction } from "./actions";

export default async function CategoriesPage() {
  const supabase = await createClient();

  const [{ data: categories, error }, { data: songCategoryRows }] = await Promise.all([
    supabase.from("categories").select("id,name,slug,parent_id").order("name"),
    supabase.from("song_categories").select("category_id")
  ]);

  const countMap = new Map<string, number>();
  for (const row of songCategoryRows || []) {
    const key = (row as any).category_id;
    countMap.set(key, (countMap.get(key) || 0) + 1);
  }

  const parentOptions = categories || [];

  return (
    <>
      <div className="top-row">
        <div>
          <div className="eyebrow">Bibliotecă</div>
          <h1>Categorii cântări</h1>
          <p className="muted">Folosește categoriile pentru Paște, Nașterea Domnului, botez, Cina Domnului, mulțumire, înmormântare și alte secțiuni.</p>
        </div>
        <Link className="btn secondary" href="/songs">Toate cântările</Link>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <h2>Adaugă categorie</h2>
          <form action={createCategoryAction} className="form-grid">
            <label className="label">Nume categorie
              <input className="input" name="name" placeholder="ex: Cina Domnului" required />
            </label>
            <label className="label">Categorie părinte, opțional
              <select className="select" name="parent_id" defaultValue="">
                <option value="">Fără categorie părinte</option>
                {parentOptions.map((category: any) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit">Creează categorie</button>
          </form>
        </section>

        <section className="card">
          <h2>Categorii existente</h2>
          {error ? <p className="error">{error.message}</p> : null}
          <div className="list compact-list">
            {(categories || []).map((category: any) => (
              <details className="management-row" key={category.id}>
                <summary>
                  <span className="row-main">
                    <span className="row-title">{category.name}</span>
                    <span className="muted small">/{category.slug}</span>
                  </span>
                  <span className="badge">{countMap.get(category.id) || 0} cântări</span>
                </summary>
                <div className="management-actions">
                  <Link className="btn secondary btn-compact" href={`/songs?category=${category.id}`}>Vezi cântările</Link>
                  <form action={deleteCategoryAction} className="inline-form delete-inline-form">
                    <input type="hidden" name="category_id" value={category.id} />
                    <input className="input compact-confirm" name="confirm" placeholder="STERGE" />
                    <button className="btn danger btn-compact" type="submit">Șterge</button>
                  </form>
                </div>
              </details>
            ))}
            {(!categories || categories.length === 0) ? <p className="muted">Nu există categorii încă.</p> : null}
          </div>
        </section>
      </div>
    </>
  );
}
