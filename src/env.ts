import { z } from 'zod';

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  AI_SERVICE_URL: z.string().url().optional().default('http://127.0.0.1:8000'),
  QDRANT_URL: z.string().url().optional().default('http://localhost:6343'),
  APP_URL: z.string().url().optional().default('http://localhost:3000'),
  ALLOWED_ORIGIN: z.string().url().optional().default('http://localhost:3000'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  INTERNAL_SERVICE_SECRET: z.string().default('default_internal_secret_for_dev'),
  LOW_BALANCE_THRESHOLD: z.coerce.number().default(5000),
  NEGATIVE_GRACE_CREDITS: z.coerce.number().default(2000),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:8000/api/v1'),
  // Falls back to NEXT_PUBLIC_APP_URL so the build never hard-crashes from a missing site URL.
  // Set NEXT_PUBLIC_SITE_URL explicitly in Vercel for correct SEO meta tags.
  NEXT_PUBLIC_SITE_URL: z.string().url().optional().default('http://localhost:3000'),
});

const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  AI_SERVICE_URL: process.env.AI_SERVICE_URL,
  QDRANT_URL: process.env.QDRANT_URL,
  APP_URL: process.env.APP_URL,
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET,
  LOW_BALANCE_THRESHOLD: process.env.LOW_BALANCE_THRESHOLD,
  NEGATIVE_GRACE_CREDITS: process.env.NEGATIVE_GRACE_CREDITS,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

// Validate environment variables
// During Vercel builds, server env vars may not be available for static pages.
// We warn instead of throwing so the build can proceed.
const parsedServer = typeof window === 'undefined'
  ? serverSchema.safeParse(processEnv)
  : { success: true as const, data: {} as z.infer<typeof serverSchema> };

const parsedClient = clientSchema.safeParse(processEnv);

if (!parsedServer.success) {
  console.warn('⚠️ Invalid server environment variables:', parsedServer.error.format());
}

if (!parsedClient.success) {
  console.error('❌ Invalid client environment variables:', parsedClient.error.format());
  // Warn in production builds rather than hard-crashing — the Vercel env panel
  // provides these values at runtime even if they're absent at build time.
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Invalid client environment variables. Check NEXT_PUBLIC_SITE_URL.');
  }
}

export const env = {
  ...(parsedServer.success ? parsedServer.data : serverSchema.parse({})),
  ...(parsedClient.success ? parsedClient.data : clientSchema.parse({})),
};
