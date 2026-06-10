import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// GLOBAL MOCKS
// ---------------------------------------------------------------------------

// 1. Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: Array(1536).fill(0.1) }],
          usage: { total_tokens: 10, prompt_tokens: 10 }
        })
      },
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mocked AI response' } }]
          })
        }
      }
    }))
  };
});

// 2. Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({ id: 'cs_test_mock123', url: 'https://checkout.stripe.com/mock' })
        }
      },
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({ id: 'sub_mock123', status: 'active' })
      },
      webhooks: {
        constructEvent: vi.fn().mockReturnValue({ type: 'checkout.session.completed', data: { object: {} } })
      }
    }))
  };
});

// 3. Mock Qdrant (as requested by Master Context)
vi.mock('@qdrant/js-client-rest', () => {
  return {
    QdrantClient: class {
      search = vi.fn().mockResolvedValue([{ id: 'mock-chunk-1', score: 0.99, payload: { text: 'mock chunk text' } }]);
      upsert = vi.fn().mockResolvedValue({ status: 'completed' });
      getCollection = vi.fn().mockResolvedValue({});
      createCollection = vi.fn().mockResolvedValue({});
      deleteCollection = vi.fn().mockResolvedValue({});
    }
  };
});

// Mock BullMQ
vi.mock('bullmq', () => {
  return {
    Queue: class {
      add = vi.fn().mockResolvedValue({ id: 'mock-job-id' });
      remove = vi.fn().mockResolvedValue(undefined);
    },
    Worker: class {
      on = vi.fn();
      close = vi.fn();
    }
  };
});

// 4. Mock ioredis
vi.mock('ioredis', () => {
  const mockRedisInstance = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    setex: vi.fn().mockResolvedValue('OK'),
    call: vi.fn().mockResolvedValue([1, 'doc:chunk:1', ['score', '0.99']]),
    pipeline: vi.fn().mockReturnValue({
      hset: vi.fn(),
      set: vi.fn(),
      expire: vi.fn(),
      del: vi.fn(),
      exec: vi.fn().mockResolvedValue([])
    }),
    on: vi.fn(),
    connect: vi.fn(),
    quit: vi.fn()
  };

  class MockRedis {
    constructor() {
      return mockRedisInstance;
    }
  }
  
  return {
    default: MockRedis,
    Redis: MockRedis
  };
});

// ---------------------------------------------------------------------------
// TEST LIFECYCLE HOOKS
// ---------------------------------------------------------------------------

beforeAll(() => {
  // Suppress extremely noisy logs during tests if necessary
  // vi.spyOn(console, 'log').mockImplementation(() => {});
  // vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  // Clear mock history between tests to ensure test isolation
  vi.clearAllMocks();
  // Clear database to prevent unique constraint errors
  await db.messageFeedback.deleteMany();
  await db.citation.deleteMany();
  await db.message.deleteMany();
  await db.chatSession.deleteMany();
  await db.document.deleteMany();
  await db.user.deleteMany();
});

afterAll(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// APP ROUTER SUPERTEST WRAPPER
// ---------------------------------------------------------------------------
import express from 'express';
import supertest from 'supertest';
import { db } from '@/lib/db';
import { NextRequest } from 'next/server';

export const prisma = db;

// Mock auth to read from a global or mock it per test
export let mockSessionUser: any = null;

export function setMockUser(user: any) {
  mockSessionUser = user;
}

vi.mock('@/auth', () => ({
  auth: vi.fn().mockImplementation(async () => {
    if (mockSessionUser) return { user: { id: mockSessionUser.id } };
    return null;
  })
}));

export function authHeader(user: any): [string, string] {
  setMockUser(user);
  return ['x-test-user-id', user.id];
}

const app = express();
app.use(express.json());

// Helper to convert Express req to NextRequest and call handler
async function handleNextRoute(handler: any, req: express.Request, res: express.Response, params?: any) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const init: RequestInit = {
      method: req.method,
      headers: new Headers(req.headers as Record<string, string>),
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = JSON.stringify(req.body);
    }
    const nextReq = new NextRequest(url, init);
    const nextRes = await handler(nextReq, { params: Promise.resolve(params || {}) });
    
    // Copy headers
    nextRes.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value);
    });
    res.status(nextRes.status);
    
    if (nextRes.body) {
      const reader = nextRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

app.post('/api/chat/create', async (req, res) => {
  const { POST } = await import('@/app/api/chat/create/route');
  await handleNextRoute(POST, req, res);
});

app.post('/api/chat/:sessionId/message', async (req, res) => {
  const { POST } = await import('@/app/api/chat/[sessionId]/message/route');
  await handleNextRoute(POST, req, res, { sessionId: req.params.sessionId });
});

app.get('/api/chat/:sessionId/history', async (req, res) => {
  const { GET } = await import('@/app/api/chat/[sessionId]/history/route');
  await handleNextRoute(GET, req, res, { sessionId: req.params.sessionId });
});

app.post('/api/chat/:sessionId/feedback', async (req, res) => {
  const { POST } = await import('@/app/api/chat/[sessionId]/feedback/route');
  await handleNextRoute(POST, req, res, { sessionId: req.params.sessionId });
});

export const agent = supertest(app);
