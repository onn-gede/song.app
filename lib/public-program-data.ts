import {cache} from "react";
import {createClient} from "@/lib/supabase/server";

// generateMetadata și pagina folosesc același rezultat în cadrul cererii.
export const loadPublicProgram=cache(async(slug:string)=>{const supabase=await createClient();return supabase.rpc("get_shared_meeting_v79",{p_public_slug:slug});});
