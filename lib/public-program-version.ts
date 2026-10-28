import { createHash } from "node:crypto";
export function publicProgramVersion(data: unknown) {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}
