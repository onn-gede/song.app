import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
export default async function EditorSection({ children }: { children: React.ReactNode }) {
  try { await requireProfile("editor"); } catch { redirect("/songs"); }
  return children;
}
