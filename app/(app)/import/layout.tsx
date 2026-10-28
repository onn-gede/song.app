import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
export default async function ProtectedSection({ children }: { children: React.ReactNode }) {
  try { await requireProfile("editor"); }
  catch { redirect("/dashboard"); }
  return children;
}
