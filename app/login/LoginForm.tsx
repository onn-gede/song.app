"use client";

import { useActionState,useState } from "react";
import { signInAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({welcome=false}:{welcome?:boolean}) {
  const [email,setEmail]=useState("");
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className={welcome?"welcome-login-form":"card login-card form-grid"}>
      <div>
        {welcome?<><h2 id="welcome-login-heading">Autentificare</h2><p>Intră în spațiul echipei tale.</p></>:<><div className="eyebrow">Acces intern</div><h1>SongApp BCBgiroc</h1><p className="muted">Autentifică-te cu contul aprobat de administrator.</p></>}
      </div>

      {state.error ? <div className="error" role="alert">{state.error}</div> : null}

      <label className="label">
        Email
        <input className="input" name="email" value={email} onChange={event=>setEmail(event.target.value)} type="email" autoComplete="email" placeholder="nume@exemplu.ro" required />
      </label>

      <label className="label">
        Parolă
        <input className="input" name="password" type="password" autoComplete="current-password" placeholder="Parola ta" required />
      </label>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Se verifică..." : "Intră în aplicație"}
      </button>
    </form>
  );
}
