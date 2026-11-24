"use server";

import { logAuthFailure } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type LoginState = { error?: string; message?: string };

function passwordResetBaseUrl(origin: string | null) {
  if (origin) {
    try {
      const candidate = new URL(origin);
      if (candidate.protocol === "http:" && ["localhost", "127.0.0.1"].includes(candidate.hostname)) {
        return candidate.origin;
      }
    } catch {}
  }
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function requestPasswordResetAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const generic = "Dacă adresa aparține unui cont, vei primi un email cu linkul de resetare.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return { message: generic };

  const requestHeaders = await headers();
  const redirectTo = `${passwordResetBaseUrl(requestHeaders.get("origin"))}/reset-password`;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) console.warn("Password reset email unavailable");
  return { message: generic };
}

export async function signInAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password || email.length > 320 || password.length > 1024) {
    return { error: "Completează emailul și parola." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await logAuthFailure("auth.failure", email);
    return { error: "Emailul sau parola nu sunt corecte." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user!.id)
    .maybeSingle();
  if (!profile?.is_active) {
    await logAuthFailure("auth.denied", email);
    await supabase.auth.signOut();
    return { error: "Contul este inactiv sau așteaptă aprobarea unui administrator." };
  }
  const { error: auditError } = await supabase.rpc("record_activity_v48", {
    p_event: "auth.login",
    p_path: "/login",
  });
  if (auditError) {
    await supabase.auth.signOut();
    return { error: "Autentificarea nu poate fi finalizată. Administrator: verifică UPDATE-V48.sql." };
  }
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  try {
    await supabase.rpc("record_activity_v48", { p_event: "auth.logout", p_path: "/login" });
  } finally {
    await supabase.auth.signOut();
  }
  redirect("/login");
}
