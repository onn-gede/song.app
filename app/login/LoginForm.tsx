"use client";

import { useActionState } from "react";
import { signInAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="card login-card form-grid">
      <div>
        <div className="eyebrow">Acces intern</div>
        <h1>Biblioteca de cântări</h1>
        <p className="muted">Intră cu userul creat în Supabase Authentication.</p>
      </div>

      {state.error ? <div className="error">{state.error}</div> : null}

      <label className="label">
        Email
        <input className="input" name="email" type="email" autoComplete="email" required />
      </label>

      <label className="label">
        Parolă
        <input className="input" name="password" type="password" autoComplete="current-password" required />
      </label>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Se verifică..." : "Intră în aplicație"}
      </button>
    </form>
  );
}
