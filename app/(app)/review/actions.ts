"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const allowedStatuses = new Set(["pending", "parsed", "needs_review", "approved", "failed"]);

export type BulkImportStatusState = {
  ok: boolean;
  message?: string;
  error?: string;
  updated?: number;
};

function readString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function isMissingRpcError(message: string) {
  const value = message.toLowerCase();
  return value.includes("could not find the function") || value.includes("schema cache") || value.includes("pgrst202");
}

export async function bulkUpdateImportStatusAction(
  _prevState: BulkImportStatusState,
  formData: FormData
): Promise<BulkImportStatusState> {
  const status = readString(formData, "status");
  const ids = Array.from(new Set(formData.getAll("file_ids").map(String).filter(Boolean)));

  if (!allowedStatuses.has(status)) {
    return { ok: false, error: "Status invalid." };
  }

  if (ids.length === 0) {
    return { ok: false, error: "Alege cel puțin un import." };
  }

  const supabase = await createClient();

  // Preferăm RPC-ul security definer din v11, pentru că respectă permisiunile editor/admin
  // și evită problemele de RLS. Dacă schema cache nu l-a încărcat încă, cădem pe update direct.
  const rpcResult = await supabase.rpc("bulk_update_import_status", {
    p_file_ids: ids,
    p_status: status
  });

  if (rpcResult.error) {
    if (!isMissingRpcError(rpcResult.error.message)) {
      return { ok: false, error: rpcResult.error.message };
    }

    const directResult = await supabase
      .from("song_files")
      .update({ import_status: status })
      .in("id", ids);

    if (directResult.error) {
      return { ok: false, error: directResult.error.message };
    }

    revalidatePath("/review");
    revalidatePath("/songs");

    return {
      ok: true,
      updated: ids.length,
      message: `Status schimbat pentru ${ids.length} importuri.`
    };
  }

  const updated = typeof rpcResult.data === "number" ? rpcResult.data : ids.length;

  revalidatePath("/review");
  revalidatePath("/songs");

  return {
    ok: true,
    updated,
    message: `Status schimbat pentru ${updated} importuri.`
  };
}
