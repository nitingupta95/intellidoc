import { createExpressApp } from '../../app';
import request from 'supertest';
import { vi } from 'vitest';
import * as bcrypt from 'bcryptjs';

const { prismock, redisMock } = vi.hoisted(() => {
  const { PrismockClient } = require('prismock');
  const RedisMock = require('ioredis-mock');
  return {
    prismock: new PrismockClient(),
    redisMock: new RedisMock()
  };
});

// Inject the Redis mock
vi.mock('../../lib/redis/client', () => ({
  getRedisClient: async () => redisMock
}));

// Inject the Prismock client
vi.mock('../../lib/db', () => ({
  prisma: prismock
}));

let seedIndex = 1;

/**
 * Creates the integration test harness using an in-memory db (Prismock)
 * and an in-memory Redis instance (ioredis-mock).
 */
export async function createTestApp() {
  const app = createExpressApp();

  return {
    app,
    prisma: prismock as any,
    redis: redisMock,
    agent: request.agent(app) // Supertest agent with cookie jar enabled
  };
}

/**
 * Truncates all tables by deleting all rows (Prismock safe equivalent to TRUNCATE).
 */
export async function truncateAllTables(prisma: any) {
  // Clearing data for tables defined in the schema
  if (prisma.user) await prisma.user.deleteMany();
  if (prisma.document) await prisma.document.deleteMany();
  if (prisma.teamMember) await prisma.teamMember.deleteMany();
}

/**
 * Prepopulates a deterministic user into the DB.
 */
export async function seedUser(prisma: any, overrides?: Partial<any>) {
  const index = seedIndex++;
  const data: any = {
    email: overrides?.email || `user${index}@test.com`,
    password: overrides?.password || bcrypt.hashSync('Test1234!', 10),
    name: overrides?.name || 'Test User',
    ...overrides
  };
  return prisma.user.create({ data });
}
