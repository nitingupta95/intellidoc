import { describe, it, expect, vi } from 'vitest';
import ioredis from 'ioredis';
import * as jwtLib from '../../../lib/jwt';
import { authMiddleware } from '../../../middleware/authMiddleware';

const mockReq = (headers = {}) => ({ headers, ip: '127.0.0.1' } as any);
const mockRes = () => {
  const r: any = {};
  r.status = vi.fn(() => r);
  r.json = vi.fn(() => r);
  r.set = vi.fn(() => r);
  return r;
};

describe('authMiddleware', () => {
  const next = vi.fn();

  it('valid Bearer token, not blacklisted → calls next(), populates req.user', async () => {
    const req = mockReq({ authorization: 'Bearer valid.token.here' });
    const res = mockRes();

    vi.spyOn(jwtLib, 'verifyAccessToken').mockReturnValue({ sub: 'user-1', role: 'user', iat: 1, exp: 2 });
    const redisClient = new ioredis();
    vi.mocked(redisClient.get).mockResolvedValue(null);

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
    expect(req.user).toMatchObject({ sub: 'user-1', role: 'user' });
  });

  it('missing Authorization header → 401 NO_TOKEN', async () => {
    const req = mockReq();
    const res = mockRes();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'NO_TOKEN' });
    expect(next).not.toHaveBeenCalled();
  });

  it('scheme is "Basic" not "Bearer" → 401 NO_TOKEN', async () => {
    const req = mockReq({ authorization: 'Basic abc1234' });
    const res = mockRes();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'NO_TOKEN' });
    expect(next).not.toHaveBeenCalled();
  });

  it('expired token → 401 TOKEN_EXPIRED', async () => {
    const req = mockReq({ authorization: 'Bearer expired.token.here' });
    const res = mockRes();

    vi.spyOn(jwtLib, 'verifyAccessToken').mockImplementation(() => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      throw err;
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_EXPIRED' });
  });

  it('invalid signature (tampered) → 401 INVALID_TOKEN', async () => {
    const req = mockReq({ authorization: 'Bearer tampered.token.here' });
    const res = mockRes();

    vi.spyOn(jwtLib, 'verifyAccessToken').mockImplementation(() => {
      const err = new Error('invalid signature');
      err.name = 'JsonWebTokenError';
      throw err;
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'INVALID_TOKEN' });
  });

  it('token present in Redis blacklist → 401 TOKEN_REVOKED', async () => {
    const req = mockReq({ authorization: 'Bearer blacklisted.token' });
    const res = mockRes();

    vi.spyOn(jwtLib, 'verifyAccessToken').mockReturnValue({ sub: 'user-1', role: 'user', iat: 1, exp: 2 });
    const redisClient = new ioredis();
    vi.mocked(redisClient.get).mockResolvedValue('1'); // Blacklisted

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_REVOKED' });
    expect(next).not.toHaveBeenCalled();
  });

  it('Redis get throws → 500 AUTH_SERVICE_ERROR, next not called', async () => {
    const req = mockReq({ authorization: 'Bearer valid.token.here' });
    const res = mockRes();

    vi.spyOn(jwtLib, 'verifyAccessToken').mockReturnValue({ sub: 'user-1', role: 'user', iat: 1, exp: 2 });
    const redisClient = new ioredis();
    vi.mocked(redisClient.get).mockRejectedValue(new Error('connection refused'));

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'AUTH_SERVICE_ERROR' });
    expect(next).not.toHaveBeenCalled();
  });
});
