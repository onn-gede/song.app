import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("is_active").eq("id",user.id).maybeSingle();
    if (profile?.is_active) redirect("/dashboard");
    return <main className="login-wrap"><section className="card"><h1>Acces indisponibil</h1><p>Contul nu are un profil activ. Contactează administratorul.</p><form action={signOutAction}><button className="btn">Ieșire din cont</button></form></section></main>;
  }

  return (
    <main className="login-wrap">
      <LoginForm />
    </main>
  );
}
