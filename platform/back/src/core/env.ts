import { z } from "zod";
import { config } from "dotenv";

config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["dev", "prod"]).default("dev"),
  PORT: z.coerce.number().default(3001),

  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),

  API42_CLIENT_UID: z.string().min(1),
  API42_CLIENT_SECRET: z.string().min(1),

  // Root-Me API session cookie value (Préférences → API on root-me.org).
  // Optional — the Root-Me module just refuses to sync if absent.
  ROOTME_API_KEY: z.string().optional(),

  BASE_FRONT_URL: z.string().url(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
