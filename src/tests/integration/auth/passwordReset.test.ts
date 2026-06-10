import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { createTestApp, truncateAllTables, seedUser } from '../../helpers/createTestApp';

vi.mock('../../../lib/email', () => ({
  emailService: { sendPasswordReset: vi.fn().mockResolvedValue(undefined) }
}));
import { emailService } from '../../../lib/email';

describe('POST /api/auth/forgot-password & reset', () => {
  let app: any, prisma: any, redis: any, agent: any;
  let testUser: any;

  beforeAll(async () => {
    ({ app, prisma, redis, agent } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    testUser = await seedUser(prisma);
    vi.clearAllMocks();
  });

  async function getResetToken(userId: string) {
    const keys = await redis.keys(`reset:${userId}:*`);
    return keys[0]?.split(':')[2];
  }

  it('stores reset token in Redis with 900s TTL', async () => {
    await agent.post('/api/auth/forgot-password').send({ email: testUser.email });
    const keys = await redis.keys(`reset:${testUser.id}:*`);
    expect(keys.length).toBe(1);
    const ttl = await redis.ttl(keys[0]);
    expect(ttl).toBeGreaterThan(890);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it('calls email service with correct address', async () => {
    await agent.post('/api/auth/forgot-password').send({ email: testUser.email });
    expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
      testUser.email,
      expect.any(String)
    );
  });

  it('returns 200 for unknown email (no enumeration)', async () => {
    const res = await agent.post('/api/auth/forgot-password').send({ email: 'nobody@test.com' });
    expect(res.status).toBe(200);
    expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('resets password with valid token', async () => {
    await agent.post('/api/auth/forgot-password').send({ email: testUser.email });
    const token = await getResetToken(testUser.id);
    
    const res = await agent.post('/api/auth/reset-password')
      .send({ token, newPassword: 'NewPass5678!' });
    expect(res.status).toBe(200);

    // Verify new password works for login
    const loginRes = await agent.post('/api/auth/login')
      .send({ email: testUser.email, password: 'NewPass5678!' });
    expect(loginRes.status).toBe(200);
  });

  it('deletes reset token after use', async () => {
    await agent.post('/api/auth/forgot-password').send({ email: testUser.email });
    const token = await getResetToken(testUser.id);
    
    await agent.post('/api/auth/reset-password').send({ token, newPassword: 'NewPass5678!' });
    const keysAfter = await redis.keys(`reset:${testUser.id}:*`);
    expect(keysAfter.length).toBe(0);
  });

  it('rejects second use of same token', async () => {
    await agent.post('/api/auth/forgot-password').send({ email: testUser.email });
    const token = await getResetToken(testUser.id);
    
    await agent.post('/api/auth/reset-password').send({ token, newPassword: 'NewPass5678!' });
    const res2 = await agent.post('/api/auth/reset-password').send({ token, newPassword: 'AnotherPass1!' });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toBe('INVALID_RESET_TOKEN');
  });
});
