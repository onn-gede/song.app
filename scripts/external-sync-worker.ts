import { createClient } from "@supabase/supabase-js";
import { processNextSyncUnit } from "../lib/external-sync/worker";

async function main() {
  if (process.env.ENABLE_EXTERNAL_SYNC !== "true") { console.log("Sincronizarea pe loturi este suspendată. Folosește Import → Din link; workerul nu este necesar."); return; }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configurează NEXT_PUBLIC_SUPABASE_URL și SUPABASE_SERVICE_ROLE_KEY în mediul privat al workerului.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(25000) }) }
  });
  let stopping = false;
  const stop = () => { stopping = true; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const once = process.argv.includes("--once");
  console.log("SongApp sync worker pornit.");
  do {
    try {
      const worked = await processNextSyncUnit(client);
      if (once) break;
      // Keep idle polling moderate; process songs sequentially to respect source.
      await new Promise((resolve) => setTimeout(resolve, worked ? 1000 : 5000));
    } catch {
      // Avoid printing credentials, HTTP headers or full provider errors.
      console.error("Conexiunea workerului a eșuat. Reîncercare în 10 secunde.");
      if (once) throw new Error("Workerul nu a putut procesa lotul.");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  } while (!stopping);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
