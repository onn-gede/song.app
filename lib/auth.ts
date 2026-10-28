import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

import { canEdit } from "./permissions";
export { canEdit } from "./permissions";

const getActiveContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Trebuie să te autentifici.");
  const { data: profile, error } = await supabase.from("profiles")
    .select("id,full_name,email,role,is_active").eq("id", user.id).single();
  if (error || !profile?.is_active) throw new Error("Contul nu are acces activ.");
  return { supabase, user, profile };
});

// Request-scoped only: never share a Supabase client or identity between users.
export const requireProfile = cache(async (access: "read" | "editor" | "admin" = "read") => {
  const context = await getActiveContext();
  const { profile } = context;
  if ((access === "admin" && profile.role !== "admin") || (access === "editor" && !canEdit(profile.role))) {
    throw new Error("Nu ai permisiunea pentru această operațiune.");
  }
  return context;
});
