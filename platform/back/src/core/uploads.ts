import { mkdirSync } from "fs";
import { join } from "path";

// Resolved once at import time. We use cwd so the path is stable across
// `nest start --watch` rebuilds (which would otherwise move __dirname around).
export const UPLOADS_DIR = join(process.cwd(), "uploads");

mkdirSync(UPLOADS_DIR, { recursive: true });
