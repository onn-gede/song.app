import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
export default async function AdminLayout({children}:{children:React.ReactNode}) {
  try{await requireProfile("admin");}catch{redirect("/dashboard");}
  return children;
}
