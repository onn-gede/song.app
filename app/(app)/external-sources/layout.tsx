import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
export default async function ProtectedSection({ children }: { children: React.ReactNode }) {
  if (process.env.ENABLE_EXTERNAL_SYNC !== "true") redirect("/import");
  try { await requireProfile("editor"); }
  catch { redirect("/dashboard"); }
  return children;
}
