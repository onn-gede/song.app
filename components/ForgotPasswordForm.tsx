"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);
  return (
    <form action={formAction} className="card login-card form-grid password-access-card">
      <div>
        <div className="eyebrow">Recuperare acces</div>
        <h1>Resetează parola</h1>
        <p className="muted">Introdu adresa contului. Dacă există, Supabase va trimite un link securizat.</p>
      </div>
      {state.message ? (
        <p className="success" role="status">
          {state.message}
        </p>
      ) : null}
      <label className="label">
        Email
        <input
          className="input"
          name="email"
          type="email"
          maxLength={320}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </label>
      <button className="btn" disabled={pending}>
        {pending ? "Se trimite..." : "Trimite linkul de resetare"}
      </button>
      <Link className="btn secondary" href="/login">
        Înapoi la autentificare
      </Link>
    </form>
  );
}
