"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/browser";

type RecoveryState = "checking" | "ready" | "invalid" | "done";

export function PasswordRecoveryForm() {
  const [state, setState] = useState<RecoveryState>("checking"),
    [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setState("ready");
    }).data.subscription;
    void (async () => {
      const url = new URL(window.location.href);
      const description =
        url.searchParams.get("error_description") ||
        new URLSearchParams(url.hash.replace(/^#/, "")).get("error_description");
      if (description) {
        if (active) {
          setMessage("Linkul de resetare este invalid sau a expirat.");
          setState("invalid");
        }
        return;
      }
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) window.history.replaceState({}, "", url.pathname);
      }
      const { data } = await supabase.auth.getSession();
      if (active) setState(data.session ? "ready" : "invalid");
    })();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  function submit(formData: FormData) {
    const password = String(formData.get("password") || ""),
      confirmation = String(formData.get("confirmation") || "");
    setMessage("");
    if (password.length < 12 || password.length > 128 || password !== confirmation) {
      setMessage("Parola trebuie să aibă minimum 12 caractere și să fie confirmată identic.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage("Parola nu a putut fi schimbată. Solicită un link nou și încearcă din nou.");
        return;
      }
      await supabase.auth.signOut();
      setState("done");
      setMessage("Parola a fost schimbată. Te poți autentifica folosind parola nouă.");
    });
  }

  return (
    <section className="card login-card form-grid password-access-card">
      <div>
        <div className="eyebrow">Recuperare acces</div>
        <h1>Alege parola nouă</h1>
        <p className="muted">Parola trebuie să aibă minimum 12 caractere.</p>
      </div>
      {state === "checking" ? <p role="status">Se verifică linkul...</p> : null}
      {state === "invalid" ? (
        <>
          <p className="error" role="alert">
            {message || "Linkul de resetare este invalid sau a expirat."}
          </p>
          <Link className="btn" href="/forgot-password">
            Solicită un link nou
          </Link>
        </>
      ) : null}
      {state === "ready" ? (
        <form className="form-grid" action={submit}>
          <label className="label">
            Parola nouă
            <input
              className="input"
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="label">
            Confirmă parola
            <input
              className="input"
              name="confirmation"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
          <button className="btn" disabled={pending}>
            {pending ? "Se salvează..." : "Salvează parola nouă"}
          </button>
          {message ? (
            <p className="error" role="alert">
              {message}
            </p>
          ) : null}
        </form>
      ) : null}
      {state === "done" ? (
        <>
          <p className="success" role="status">
            {message}
          </p>
          <Link className="btn" href="/login">
            Mergi la autentificare
          </Link>
        </>
      ) : null}
      {state !== "done" ? (
        <Link className="btn secondary" href="/login">
          Înapoi la autentificare
        </Link>
      ) : null}
    </section>
  );
}
