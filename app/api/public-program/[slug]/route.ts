import { createClient } from "@/lib/supabase/server";
import { publicProgramVersion } from "@/lib/public-program-version";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{slug: string}> }) {
  const { slug } = await params;
  if (!slug || slug.length > 200) return Response.json({error:"Link invalid"},{status:404});
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_meeting", {p_public_slug: slug});
  if (error) return Response.json({error:"Verificarea a eșuat"},{status:503,headers:{"Cache-Control":"no-store"}});
  if (!data) return Response.json({error:"Linkul nu mai este activ"},{status:404,headers:{"Cache-Control":"no-store"}});
  return Response.json({version: publicProgramVersion(data)}, {headers:{"Cache-Control":"no-store"}});
}
