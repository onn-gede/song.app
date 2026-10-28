import { createServerClient } from "@supabase/ssr";
import { cache } from "react";
import { cookies } from "next/headers";

export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot always set cookies. Middleware refreshes the session.
          }
        }
      }
    }
  );
});
