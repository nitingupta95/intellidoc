import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { createTestApp, truncateAllTables } from '../../helpers/createTestApp';

describe('POST /api/auth/register', () => {
  let app: any, prisma: any, agent: any;

  beforeAll(async () => {
    ({ app, prisma, agent } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
  });

  const validBody = {
    name: 'Test User',
    email: 'test@intellidoc.ai',
    password: 'Test1234!'
  };

  it('registers a new user and returns tokens', async () => {
    const res = await agent.post('/api/auth/register').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ userId: expect.any(String), accessToken: expect.any(String) });
    expect(res.body.refreshToken).toBeDefined();

    // Verify DB state
    const user = await prisma.user.findUnique({ where: { email: validBody.email } });
    expect(user).not.toBeNull();
    expect(user!.password).not.toBe(validBody.password);
    expect(user!.password).toMatch(/^\$2[ab]\$/); // bcrypt prefix
  });

  it('sets httpOnly refreshToken cookie', async () => {
    const res = await agent.post('/api/auth/register').send(validBody);
    expect(res.headers['set-cookie']).toBeDefined();
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('refreshToken=');
  });

  it('returns 409 for duplicate email', async () => {
    await agent.post('/api/auth/register').send(validBody);
    const res2 = await agent.post('/api/auth/register').send(validBody);
    expect(res2.status).toBe(409);
    expect(res2.body.error).toBe('EMAIL_EXISTS');
  });

  it('returns 422 for missing name', async () => {
    const res = await agent.post('/api/auth/register').send({ ...validBody, name: undefined });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].path).toContain('name');
  });

  it('returns 422 for short password', async () => {
    const res = await agent.post('/api/auth/register').send({ ...validBody, password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].path).toContain('password');
  });

  it('returns 422 for weak password (no uppercase)', async () => {
    const res = await agent.post('/api/auth/register').send({ ...validBody, password: 'alllowercase1!' });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].path).toContain('password');
  });

  it('handles extremely long email without crashing', async () => {
    const res = await agent.post('/api/auth/register').send({ ...validBody, email: 'a'.repeat(256) + '@test.com' });
    expect(res.status).toBe(422);
  });
});
