import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32).optional(),
  OWNER_OPEN_ID: z.string().min(1).optional(),
  BUILT_IN_FORGE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  FORGE_API_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  FACEBOOK_ACCESS_TOKEN: z.string().optional(),
  VITE_OAUTH_PORTAL_URL: z.string().optional(),
  VITE_APP_ID: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.warn("[ENV] Algumas variáveis de ambiente estão faltando:", parsed.error.format());
}

export const ENV = parsed.success ? parsed.data : (process.env as z.infer<typeof envSchema>);
