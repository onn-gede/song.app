import { rm } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.join(process.cwd(), "dist-worker");
await rm(outputDirectory, { recursive: true, force: true });
