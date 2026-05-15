"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type RegisterState = { error?: string };

export async function signUpAction(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!email || !password || !confirmPassword) {
    return { error: "Completează emailul, parola și confirmarea parolei." };
  }

  if (password !== confirmPassword) {
    return { error: "Parol  ele nu se potrivesc." };
  }

  if (password.length < 6) {
    return { error: "Parola trebuie să aibă cel puțin 6 caractere." };
  }

  const supabase = await createClient();
  
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      console.error("Supabase signup error:", error);
      
      if (error.message.includes("rate limit") || error.status === 429) {
        return { error: "Prea multe încercări. Așteaptă câteva minute și încearcă din nou cu o altă adresă de email." };
      }
      
      return { error: `Înregistrare nereușită: ${error.message}` };
    }

    console.log("User signup successful:", { email, userId: data?.user?.id });

    if (data?.user?.id) {
      const profileResult = await supabase.from("profiles").insert({
        id: data.user.id,
        email,
        full_name: email.split("@")[0],
        role: "viewer",
        is_active: true
      });

      if (profileResult.error) {
        console.error("Error creating profile record:", profileResult.error);
      }
    }

    if (data?.user && !data.user.confirmed_at) {
      redirect("/login?registered=true&emailConfirmationRequired=true");
    }

    redirect("/login?registered=true");
  } catch (err) {
    console.error("Unexpected error during signup:", err);
    return { error: "A apărut o eroare neașteptată. Încearcă din nou." };
  }
}
