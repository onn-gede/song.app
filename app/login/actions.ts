"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type LoginState = { error?: string };

export async function signInAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Completează emailul și parola." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Login nereușit. Verifică emailul, parola și confirmarea userului în Supabase Auth." };
  }

  if (!data?.session) {
    return { error: "Login nereușit. Verifică emailul și parola." };
  }

  await supabase.auth.getSession();
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
