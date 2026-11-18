import { z } from "zod";

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "https://chattychatter.com",
  "https://www.chattychatter.com",
  "https://dancing-quokka-6b5001.netlify.app",
];

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    /** Extra comma-separated origins allowed by CORS, added to the defaults. */
    CORS_ORIGINS: z.string().optional(),
    CLOUD_NAME: z.string().default("dezclgtpg"),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_SECRET: z.string().optional(),
    /** Without it, emails are written to the server log instead of sent. */
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("Chatty Chatter <noreply@mail.chattychatter.com>"),
    /** Where emailed links point. */
    APP_URL: z.url().default("https://chattychatter.com"),
  })
  .transform((env) => ({
    ...env,
    isProduction: env.NODE_ENV === "production",
    corsOrigins: [
      ...DEFAULT_ORIGINS,
      ...(env.CORS_ORIGINS?.split(",")
        .map((o) => o.trim())
        .filter(Boolean) ?? []),
    ],
  }));

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }
  return result.data;
}

/** Netlify deploy previews get their own subdomain per PR. */
const DEPLOY_PREVIEW_ORIGIN = /^https:\/\/deploy-preview-\d+--dancing-quokka-6b5001\.netlify\.app$/;

export function isAllowedOrigin(env: Env, origin: string | undefined): boolean {
  // Same-origin requests and non-browser clients send no Origin header.
  if (!origin) return true;
  return env.corsOrigins.includes(origin) || DEPLOY_PREVIEW_ORIGIN.test(origin);
}
