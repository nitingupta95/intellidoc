import { describe, it, expect, vi, beforeAll } from 'vitest';
import ioredis from 'ioredis';
import { loginRateLimiter, clearLoginAttempts } from '../../../middleware/rateLimiter';

const mockReq = (ip = '127.0.0.1') => ({ ip } as any);
const mockRes = () => {
  const r: any = {};
  r.status = vi.fn(() => r);
  r.json = vi.fn(() => r);
  r.set = vi.fn(() => r);
  return r;
};

describe('Rate Limiter', () => {
  const next = vi.fn();
  let redisClient: ioredis;

  beforeAll(() => {
    redisClient = new ioredis();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('0 prior attempts → next() called, attempt counter incremented to 1', async () => {
    const req = mockReq();
    const res = mockRes();

    vi.mocked(redisClient.get).mockResolvedValueOnce(null);

    await loginRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const pipeline = redisClient.pipeline();
    expect(pipeline.set).toHaveBeenCalledWith('login_attempts:127.0.0.1', 1);
    expect(pipeline.expire).toHaveBeenCalledWith('login_attempts:127.0.0.1', 900);
  });

  it('4 prior attempts → next() called (still under limit)', async () => {
    const req = mockReq();
    const res = mockRes();

    vi.mocked(redisClient.get).mockResolvedValueOnce('4');

    await loginRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const pipeline = redisClient.pipeline();
    expect(pipeline.set).toHaveBeenCalledWith('login_attempts:127.0.0.1', 5);
  });

  it('5 prior attempts → 429 TOO_MANY_ATTEMPTS, retryAfter 900', async () => {
    const req = mockReq();
    const res = mockRes();

    vi.mocked(redisClient.get).mockResolvedValueOnce('5');

    await loginRateLimiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOO_MANY_ATTEMPTS', retryAfter: 900 });
  });

  it('429 response includes Retry-After header', async () => {
    const req = mockReq();
    const res = mockRes();

    vi.mocked(redisClient.get).mockResolvedValueOnce('5');

    await loginRateLimiter(req, res, next);

    expect(res.set).toHaveBeenCalledWith('Retry-After', '900');
  });

  it('10 prior attempts (over limit) → same 429 response', async () => {
    const req = mockReq();
    const res = mockRes();

    vi.mocked(redisClient.get).mockResolvedValueOnce('10');

    await loginRateLimiter(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.set).toHaveBeenCalledWith('Retry-After', '900');
  });

  it('clearLoginAttempts(ip) → redis.del called', async () => {
    await clearLoginAttempts('127.0.0.1');
    expect(redisClient.del).toHaveBeenCalledWith('login_attempts:127.0.0.1');
  });

  it('redis unavailable → next() called anyway (fail open)', async () => {
    const req = mockReq();
    const res = mockRes();

    vi.mocked(redisClient.get).mockRejectedValueOnce(new Error('Connection timeout'));

    await loginRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });
});
