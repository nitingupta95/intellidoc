import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { createTestApp, truncateAllTables, seedUser } from '../../helpers/createTestApp';
import supertest from 'supertest';
import * as bcrypt from 'bcryptjs';
import { expiredTokenFor } from '../../factories/auth.factory';

describe('POST /api/auth/refresh', () => {
  let app: any, prisma: any, redis: any, agent: any;
  let testUser: any;
  let getCreds: any;

  beforeAll(async () => {
    ({ app, prisma, redis, agent } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    testUser = await seedUser(prisma, { password: await bcrypt.hash('Test1234!', 10) });
    getCreds = () => ({ email: testUser.email, password: 'Test1234!' });
  });

  async function loginAndGetTokens() {
    const res = await agent.post('/api/auth/login').send(getCreds());
    const cookie = res.headers['set-cookie']?.find((c: string) => c.startsWith('refreshToken='));
    const refreshToken = cookie?.split(';')[0].split('=')[1];
    return { accessToken: res.body.accessToken, refreshToken };
  }

  it('issues new token pair on valid refresh cookie', async () => {
    const { refreshToken } = await loginAndGetTokens();
    const res = await agent
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken); // rotated
  });

  it('old refresh token removed from Redis after rotation', async () => {
    const { refreshToken } = await loginAndGetTokens();
    const keysBefore = await redis.keys(`refresh:${testUser.id}:*`);
    const oldKey = keysBefore[0];
    
    await agent.post('/api/auth/refresh').set('Cookie', `refreshToken=${refreshToken}`);
    const oldValue = await redis.get(oldKey);
    expect(oldValue).toBeNull();
  });

  it('new refresh token stored in Redis', async () => {
    const { refreshToken } = await loginAndGetTokens();
    await supertest(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${refreshToken}`);
    // After refresh, exactly one key should exist for the user
    const keysAfter = await redis.keys(`refresh:${testUser.id}:*`);
    expect(keysAfter.length).toBe(1);
  });

  it('returns 401 for expired refresh token', async () => {
    const expiredToken = expiredTokenFor(testUser);
    const res = await supertest(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('TOKEN_EXPIRED');
    expect(res.headers['set-cookie'][0]).toContain('refreshToken=;');
  });

  it('detects token reuse — same token sent twice', async () => {
    const { refreshToken } = await loginAndGetTokens();
    await supertest(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${refreshToken}`);
    const res2 = await supertest(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${refreshToken}`);
    expect(res2.status).toBe(401);
    expect(res2.body.error).toBe('TOKEN_REUSE');
  });

  it('revokes ALL user tokens on reuse detection (family invalidation)', async () => {
    const { refreshToken } = await loginAndGetTokens();
    await supertest(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${refreshToken}`);
    await supertest(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${refreshToken}`);
    
    // After reuse detected, no refresh keys should remain for user
    const keysLeft = await redis.keys(`refresh:${testUser.id}:*`);
    expect(keysLeft.length).toBe(0);
  });

  it('returns 401 when no cookie sent', async () => {
    const res = await supertest(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NO_TOKEN');
  });
});
