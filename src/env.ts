import { z } from 'zod';

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  AI_SERVICE_URL: z.string().url().default('http://127.0.0.1:8000'),
  QDRANT_URL: z.string().url().default('http://localhost:6343'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  ALLOWED_ORIGIN: z.string().url().default('http://localhost:3000'),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:8000/api/v1'),
});

const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  AI_SERVICE_URL: process.env.AI_SERVICE_URL,
  QDRANT_URL: process.env.QDRANT_URL,
  APP_URL: process.env.APP_URL,
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
};

// Validate environment variables
const parsedServer = typeof window === 'undefined' ? serverSchema.safeParse(processEnv) : { success: true, data: {} as z.infer<typeof serverSchema> };
const parsedClient = clientSchema.safeParse(processEnv);

if (!parsedServer.success) {
  console.error('❌ Invalid server environment variables:', parsedServer.error.format());
  throw new Error('Invalid server environment variables');
}

if (!parsedClient.success) {
  console.error('❌ Invalid client environment variables:', parsedClient.error.format());
  throw new Error('Invalid client environment variables');
}

export const env = {
  ...parsedServer.data,
  ...parsedClient.data,
};
