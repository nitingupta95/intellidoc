import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../transcribe/route';
import { auth } from '@/auth';
import { getRedisClient } from '@/lib/redis/client';
import { db } from '@/lib/db';
import OpenAI from 'openai';

// Mock dependencies
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/redis/client', () => ({
  getRedisClient: vi.fn().mockResolvedValue({
    incr: vi.fn(),
    expire: vi.fn(),
    get: vi.fn(),
    setex: vi.fn(),
  }),
}));
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock('openai', () => {
  const mockCreate = vi.fn().mockResolvedValue({ text: 'Mock transcript' });
  class MockOpenAI {
    audio = {
      transcriptions: {
        create: mockCreate,
      },
    };
  }
  return {
    default: MockOpenAI,
    toFile: vi.fn().mockResolvedValue('mocked-file'),
  };
});

describe('POST /api/voice/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createFormData = (fileSize = 1000, mimeType = 'audio/webm') => {
    const formData = new FormData();
    if (fileSize > 0) {
      const blob = new Blob([new ArrayBuffer(fileSize)], { type: mimeType });
      formData.append('file', blob, 'test.webm');
    }
    return formData;
  };

  it('should return 401 if unauthorized', async () => {
    (auth as any).mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/voice/transcribe', {
      method: 'POST',
      body: createFormData(),
    });
    
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should return 400 if no file provided', async () => {
    (auth as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    const formData = new FormData();
    const req = new Request('http://localhost/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });
    
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 413 if file is too large', async () => {
    (auth as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    const req = new Request('http://localhost/api/voice/transcribe', {
      method: 'POST',
      body: createFormData(15000000), // 15MB
    });
    
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it('should return 415 if mime type is unsupported', async () => {
    (auth as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    const req = new Request('http://localhost/api/voice/transcribe', {
      method: 'POST',
      body: createFormData(1000, 'audio/wav'),
    });
    
    const res = await POST(req);
    expect(res.status).toBe(415);
  });

  it('should return 429 if rate limit exceeded', async () => {
    (auth as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    const mockRedis = {
      incr: vi.fn().mockResolvedValue(21),
      expire: vi.fn(),
      get: vi.fn(),
      setex: vi.fn(),
    };
    (getRedisClient as any).mockResolvedValueOnce(mockRedis);
    
    const req = new Request('http://localhost/api/voice/transcribe', {
      method: 'POST',
      body: createFormData(),
    });
    
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('should return cached transcript if available', async () => {
    (auth as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    const mockRedis = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn(),
      get: vi.fn().mockResolvedValue('Cached transcript'),
      setex: vi.fn(),
    };
    (getRedisClient as any).mockResolvedValueOnce(mockRedis);
    
    const req = new Request('http://localhost/api/voice/transcribe', {
      method: 'POST',
      body: createFormData(),
    });
    
    const res = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.cached).toBe(true);
    expect(data.transcript).toBe('Cached transcript');
  });

  it('should call Whisper API and return new transcript', async () => {
    (auth as any).mockResolvedValueOnce({ user: { id: 'user-1' } });
    const mockRedis = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn(),
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn(),
    };
    (getRedisClient as any).mockResolvedValue(mockRedis);
    (db.user.findUnique as any).mockResolvedValueOnce({ openaiKey: 'test-key' });
    
    const req = new Request('http://localhost/api/voice/transcribe', {
      method: 'POST',
      body: createFormData(),
    });
    
    const res = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.cached).toBe(false);
    expect(data.transcript).toBe('Mock transcript');
    expect(mockRedis.setex).toHaveBeenCalled();
  });
});
