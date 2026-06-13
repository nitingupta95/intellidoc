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
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:8000/api/v1'),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
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
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
};

// Validate environment variables
// During Vercel builds, server env vars may not be available for static pages.
// We warn instead of throwing so the build can proceed.
const parsedServer = typeof window === 'undefined' ? serverSchema.safeParse(processEnv) : { success: true as const, data: {} as z.infer<typeof serverSchema> };
const parsedClient = clientSchema.safeParse(processEnv);

if (!parsedServer.success) {
  console.warn('⚠️ Invalid server environment variables:', parsedServer.error.format());
  // Don't throw during build — these are only needed at runtime in API routes
}

if (!parsedClient.success) {
  console.warn('⚠️ Invalid client environment variables:', parsedClient.error.format());
}

export const env = {
  ...(parsedServer.success ? parsedServer.data : serverSchema.parse({})),
  ...(parsedClient.success ? parsedClient.data : clientSchema.parse({})),
};

