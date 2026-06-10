import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, verifyAccessToken } from '../../../lib/jwt';

// Ensure the module is properly mocked for spying/overriding
vi.mock('jsonwebtoken', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jsonwebtoken')>();
  return {
    ...actual,
    default: {
      sign: vi.fn(actual.sign),
      verify: vi.fn(actual.verify),
      TokenExpiredError: actual.TokenExpiredError,
      JsonWebTokenError: actual.JsonWebTokenError,
    },
    sign: vi.fn(actual.sign),
    verify: vi.fn(actual.verify),
    TokenExpiredError: actual.TokenExpiredError,
    JsonWebTokenError: actual.JsonWebTokenError,
  };
});

describe('JWT Functions', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe('generateAccessToken', () => {
    it('returns a string', () => {
      const token = generateAccessToken('user-123', 'user');
      expect(typeof token).toBe('string');
    });

    it('decoded sub matches userId and role matches role', () => {
      const token = generateAccessToken('user-123', 'admin');
      const decoded = jwt.verify(token, process.env.AUTH_SECRET || 'secret') as any;
      expect(decoded.sub).toBe('user-123');
      expect(decoded.role).toBe('admin');
    });

    it('expires in 15 minutes (900 seconds)', () => {
      const token = generateAccessToken('user-123', 'user');
      const decoded = jwt.verify(token, process.env.AUTH_SECRET || 'secret') as any;
      expect(decoded.exp - decoded.iat).toBe(900);
    });
  });

  describe('generateRefreshToken', () => {
    it('returns a string', () => {
      const token = generateRefreshToken('user-123');
      expect(typeof token).toBe('string');
    });

    it('expires in 7 days (604800 seconds)', () => {
      const token = generateRefreshToken('user-123');
      const decoded = jwt.verify(token, process.env.AUTH_SECRET || 'secret') as any;
      expect(decoded.exp - decoded.iat).toBe(604800);
    });
  });

  describe('verifyAccessToken', () => {
    it('valid token → returns decoded payload', () => {
      const token = generateAccessToken('user-123', 'admin');
      const payload = verifyAccessToken(token);
      expect(payload).toMatchObject({ sub: 'user-123', role: 'admin' });
    });

    it('advance fake clock past expiry → throws TokenExpiredError', () => {
      const token = generateAccessToken('user-123', 'user');
      // Advance by 15 mins + 1 second
      vi.setSystemTime(Date.now() + 901_000);
      expect(() => verifyAccessToken(token)).toThrow(jwt.TokenExpiredError);
    });

    it('tampered signature → throws JsonWebTokenError', () => {
      const token = generateAccessToken('user-123', 'user');
      const tampered = token.slice(0, -1) + 'a';
      expect(() => verifyAccessToken(tampered)).toThrow(jwt.JsonWebTokenError);
    });

    it('null input → throws, does not crash process', () => {
      expect(() => verifyAccessToken(null as any)).toThrow();
    });
  });
});
