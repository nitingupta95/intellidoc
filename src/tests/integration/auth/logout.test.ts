import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { createTestApp, truncateAllTables, seedUser } from '../../helpers/createTestApp';
import * as bcrypt from 'bcryptjs';

describe('POST /api/auth/logout', () => {
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

  it('deletes refresh token from Redis on logout', async () => {
    const { accessToken, refreshToken } = await loginAndGetTokens();
    const keysBefore = await redis.keys(`refresh:${testUser.id}:*`);
    expect(keysBefore.length).toBe(1);

    await agent.post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', `refreshToken=${refreshToken}`);

    const keysAfter = await redis.keys(`refresh:${testUser.id}:*`);
    expect(keysAfter.length).toBe(0);
  });

  it('clears the refreshToken cookie', async () => {
    const { accessToken, refreshToken } = await loginAndGetTokens();
    const res = await agent.post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', `refreshToken=${refreshToken}`);

    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=;/);
    expect(res.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('blacklists the access token in Redis', async () => {
    const { accessToken, refreshToken } = await loginAndGetTokens();
    await agent.post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', `refreshToken=${refreshToken}`);

    const blacklistKey = `blacklist:${accessToken}`;
    const blacklisted = await redis.get(blacklistKey);
    expect(blacklisted).toBe('1');
  });

  it('blacklisted access token rejected on protected route', async () => {
    const { accessToken, refreshToken } = await loginAndGetTokens();
    await agent.post('/api/auth/logout').set('Authorization', `Bearer ${accessToken}`).set('Cookie', `refreshToken=${refreshToken}`);
    
    // Attempt to use blacklisted token
    const res = await agent.get('/api/documents').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('TOKEN_REVOKED');
  });

  it('logout is idempotent — second call returns 200', async () => {
    const { accessToken, refreshToken } = await loginAndGetTokens();
    await agent.post('/api/auth/logout').set('Authorization', `Bearer ${accessToken}`).set('Cookie', `refreshToken=${refreshToken}`);
    const res2 = await agent.post('/api/auth/logout').set('Authorization', `Bearer ${accessToken}`).set('Cookie', `refreshToken=${refreshToken}`);
    expect(res2.status).toBe(200);
  });

  it('POST /api/auth/logout-all removes all user tokens', async () => {
    const { accessToken: t1 } = await loginAndGetTokens();
    const { accessToken: t2 } = await loginAndGetTokens();
    
    await agent.post('/api/auth/logout-all').set('Authorization', `Bearer ${t1}`);
    const keys = await redis.keys(`refresh:${testUser.id}:*`);
    expect(keys.length).toBe(0);
  });

  it('returns 401 when no Authorization header', async () => {
    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});
