import { z } from "zod";

// Server-only environment parsing. Import in server files (API routes, server actions).
const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof EnvSchema>;
export const env: Env = EnvSchema.parse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  NODE_ENV: process.env.NODE_ENV,
});

