"use server";

import { logAuthFailure } from "@/lib/supabase/admin";
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

  if (error || !data.user) {
    await logAuthFailure("auth.failure",email);
    return { error: "Emailul sau parola nu sunt corecte." };
  }

  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id",data.user!.id).maybeSingle();
  if (!profile?.is_active) {
    await logAuthFailure("auth.denied",email);
    await supabase.auth.signOut();
    return { error: "Contul este inactiv sau așteaptă aprobarea unui administrator." };
  }
  const {error:auditError}=await supabase.rpc("record_activity_v48",{p_event:"auth.login",p_path:"/login"});
  if(auditError){await supabase.auth.signOut();return {error:"Autentificarea nu poate fi finalizată. Administrator: verifică UPDATE-V48.sql."};}
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  try { await supabase.rpc("record_activity_v48",{p_event:"auth.logout",p_path:"/login"}); } finally { await supabase.auth.signOut(); }
  redirect("/login");
}
