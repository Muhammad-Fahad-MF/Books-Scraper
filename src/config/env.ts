import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ override: true });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  GEMINI_BASE_URL: z
    .string()
    .url()
    .default("https://generativelanguage.googleapis.com/v1beta/openai/"),
  GEMINI_API_KEY: z.string(),
  GEMINI_MODEL: z.string().default("gemini-3.6-flash"),

  ENABLE_LLM_STUB: z
    .string()
    .default("false")
    .transform((val) => val === "true" || val === "1"),
  LLM_ENABLED: z
    .string()
    .default("false")
    .transform((val) => val === "true" || val === "1"),
});

export type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsed.error.format(), null, 2),
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
