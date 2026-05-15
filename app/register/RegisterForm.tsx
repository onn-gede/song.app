"use client";

import { useActionState } from "react";
import { signUpAction, type RegisterState } from "./actions";

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  return (
    <form action={formAction} className="card register-card form-grid w-full max-w-md mx-auto px-4 sm:px-6 md:px-0">
      <div className="mb-6 sm:mb-8">
        <div className="eyebrow text-xs sm:text-sm">Creeaza cont</div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold my-2">Biblioteca de cântări</h1>
        <p className="muted text-sm sm:text-base">Înregistrează-te pentru a accesa biblioteca.</p>
      </div>

      {state.error ? <div className="error text-sm sm:text-base mb-4 p-3 rounded">{state.error}</div> : null}

      <label className="label block mb-4 sm:mb-5">
        <span className="block text-sm sm:text-base font-medium mb-2">Email</span>
        <input className="input w-full px-3 sm:px-4 py-2 text-sm sm:text-base" name="email" type="email" autoComplete="email" required />
      </label>

      <label className="label block mb-4 sm:mb-5">
        <span className="block text-sm sm:text-base font-medium mb-2">Parolă</span>
        <input className="input w-full px-3 sm:px-4 py-2 text-sm sm:text-base" name="password" type="password" autoComplete="new-password" required />
      </label>

      <label className="label block mb-6 sm:mb-7">
        <span className="block text-sm sm:text-base font-medium mb-2">Confirmare parolă</span>
        <input className="input w-full px-3 sm:px-4 py-2 text-sm sm:text-base" name="confirmPassword" type="password" autoComplete="new-password" required />
      </label>

      <button className="btn w-full py-2 sm:py-3 text-sm sm:text-base font-medium rounded transition-colors" type="submit" disabled={pending}>
        {pending ? "Se înregistrează..." : "Crează cont"}
      </button>
    </form>
  );
}
