import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { createTestApp, truncateAllTables, seedUser } from '../../helpers/createTestApp';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

describe('POST /api/auth/login', () => {
  let app: any, prisma: any, redis: any, agent: any;
  let testUser: any;

  beforeAll(async () => {
    ({ app, prisma, redis, agent } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await redis.del('login_attempts:::ffff:127.0.0.1'); // clear rate limit state
    testUser = await seedUser(prisma, { password: await bcrypt.hash('Test1234!', 10) });
  });

  const getCreds = () => ({ email: testUser.email, password: 'Test1234!' });

  it('returns 200 with tokens on valid credentials', async () => {
    const res = await agent.post('/api/auth/login').send(getCreds());
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    // Verify refresh token persisted to Redis
    const keys = await redis.keys(`refresh:${testUser.id}:*`);
    expect(keys.length).toBe(1);
  });

  it('returns 401 for wrong password', async () => {
    const res = await agent.post('/api/auth/login').send({ ...getCreds(), password: 'WrongPass1!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 for non-existent email — same message as wrong password', async () => {
    const res = await agent.post('/api/auth/login').send({ email: 'nobody@test.com', password: 'Test1234!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('rate limits after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await agent.post('/api/auth/login').send({ ...getCreds(), password: 'wrong' });
    }
    const res = await agent.post('/api/auth/login').send(getCreds()); // correct creds, but locked
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('TOO_MANY_ATTEMPTS');
  });

  it('successful login clears rate limit counter', async () => {
    await redis.set('login_attempts:::ffff:127.0.0.1', '3');
    await agent.post('/api/auth/login').send(getCreds());
    const remaining = await redis.get('login_attempts:::ffff:127.0.0.1');
    expect(remaining).toBeNull();
  });

  it('admin user token contains role: admin', async () => {
    const adminUser = await seedUser(prisma, { role: 'admin' });
    const res = await agent.post('/api/auth/login').send({ email: adminUser.email, password: 'Test1234!' });
    const decoded = jwt.decode(res.body.accessToken) as any;
    expect(decoded.role).toBe('admin');
  });
});
