"use client";

import { useState, useTransition } from "react";
import { addPublicTextContributionAction, type PublicPositionOption } from "@/app/program/actions";

export function PublicTextContributionForm({ slug, positionOptions }: { slug: string; positionOptions: PublicPositionOption[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await addPublicTextContributionAction(formData);
        setMessage("Propunerea a fost trimisă. Va apărea discret cu roșu până este aprobată.");
        setOpen(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nu am putut trimite propunerea.");
        setOpen(true);
      }
    });
  }

  return (
    <section className="card public-edit-card print-hide">
      <div className="eyebrow">Intervenție text</div>
      <h2>Propune poezie / rugăciune / îndemn / mesaj</h2>
      <form action={submit} className="form-grid public-text-form">
        <input type="hidden" name="slug" value={slug} />
        <label className="label">Numele tău, opțional
          <input className="input" name="contributor_name" placeholder="Ex: Andrei" />
        </label>
        <label className="label">Poziție propusă
          <select className="select" name="proposed_position" defaultValue="">
            <option value="">La finalul programului</option>
            {positionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="label">Tip
          <select className="select" name="contribution_type" defaultValue="text">
            <option value="text">Poezie</option>
            <option value="prayer">Rugăciune</option>
            <option value="encouragement">Îndemn</option>
            <option value="message">Mesaj</option>
            <option value="break">Pauză</option>
          </select>
        </label>
        <label className="label">Titlu
          <input className="input" name="custom_title" placeholder="Poezie / Rugăciune / Îndemn / Mesaj" />
        </label>
        <label className="label">Text
          <textarea className="textarea" name="custom_text" placeholder="Scrie intervenția propusă" />
        </label>
        <label className="check-row public-checkbox">
          <input type="checkbox" name="is_backup" />
          <span>Marchează ca element de backup</span>
        </label>
        <label className="label">Notă, opțional
          <input className="input" name="notes" placeholder="Ex: doar dacă mai este timp" />
        </label>
        <button className="btn" type="submit" disabled={isPending}>{isPending ? "Se trimite…" : "Trimite propunerea"}</button>
      </form>

      {open ? (
        <div className="inline-modal-backdrop" role="dialog" aria-modal="true">
          <div className="inline-modal-card">
            <h3>{error ? "Nu am putut trimite" : "Propunere trimisă"}</h3>
            <p className={error ? "error" : "success"}>{error || message}</p>
            <button className="btn btn-compact" type="button" onClick={() => setOpen(false)}>Închide</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
