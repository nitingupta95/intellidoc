import { generateAccessToken, generateRefreshToken } from '../../lib/jwt';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

// Using a lightweight representation of the Prisma User type
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'superadmin';
  passwordHash: string;
  createdAt: Date;
}

export let seedIndex = 1;

/**
 * Creates a deterministic mock User.
 */
export function createUser(overrides?: Partial<User>): User {
  const index = seedIndex++;
  return {
    id: `test-user-id-${index.toString().padStart(3, '0')}`,
    email: `u${index}@test.com`,
    name: 'Test User',
    role: 'user',
    passwordHash: bcrypt.hashSync('Test1234!', 10),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides
  };
}

/**
 * Creates a deterministic mock Admin User.
 */
export function createAdminUser(overrides?: Partial<User>): User {
  const index = seedIndex++;
  return {
    id: `test-admin-id-${index.toString().padStart(3, '0')}`,
    email: `admin${index}@test.com`,
    name: 'Test Admin',
    role: 'admin',
    passwordHash: bcrypt.hashSync('Test1234!', 10),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides
  };
}

/**
 * Generates signed JWTs for a user using the real implementations.
 */
export function signedTokensFor(user: User): { accessToken: string; refreshToken: string } {
  return {
    accessToken: generateAccessToken(user.id, user.role),
    refreshToken: generateRefreshToken(user.id)
  };
}

/**
 * Returns an HTTP header object ready to spread into supertest requests.
 */
export function authHeader(user: User): { Authorization: string } {
  const { accessToken } = signedTokensFor(user);
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * Returns a JWT that is already expired.
 */
export function expiredTokenFor(user: User): string {
  // We use jsonwebtoken directly to force a past expiration date
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.AUTH_SECRET || 'secret',
    { expiresIn: '1ms' }
  );
}
