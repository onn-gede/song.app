import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const isPublicContribution =
    request.method === "POST" &&
    (request.nextUrl.pathname.startsWith("/program/") || request.nextUrl.pathname.startsWith("/wishlist/"));
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (isPublicContribution && contentLength > 512 * 1024) {
    return NextResponse.json({ error: "Cererea este prea mare." }, { status: 413 });
  }

  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
