import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Loads .env from the project root using Node's built-in loader (Node 21.7+,
// no dotenv dependency). Must be imported *first* in server/index.ts so every
// other module sees process.env at import time.
const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, "..", "..", ".env");
if (fs.existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn("[env] failed to load .env:", (err as Error).message);
  }
}