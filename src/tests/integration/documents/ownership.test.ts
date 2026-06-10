import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestApp, truncateAllTables, seedUser } from '../../helpers/createTestApp';
import { authHeader, expiredTokenFor } from '../../factories/auth.factory';

describe('Document API Ownership Guards', () => {
  let app: any, prisma: any, agent: any;
  let userA: any, userB: any, adminUser: any;
  let docA: any, docB: any;

  beforeAll(async () => {
    ({ app, prisma, agent } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    userA = await seedUser(prisma);
    userB = await seedUser(prisma);
    adminUser = await seedUser(prisma, { role: 'admin' });

    docA = await prisma.document.create({ data: {
      id: 'docA', userId: userA.id, filename: 'docA.pdf', mimeType: 'application/pdf', storageKey: 'keyA', status: 'READY'
    }});
    docB = await prisma.document.create({ data: {
      id: 'docB', userId: userB.id, filename: 'docB.pdf', mimeType: 'application/pdf', storageKey: 'keyB', status: 'READY'
    }});
  });

  it('userA cannot read status of docB', async () => {
    const res = await agent.get(`/api/documents/${docB.id}/status`).set(...Object.entries(authHeader(userA as any))[0] as any);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('userA cannot delete docB', async () => {
    const res = await agent.delete(`/api/documents/${docB.id}`).set(...Object.entries(authHeader(userA as any))[0] as any);
    expect(res.status).toBe(403);
    const stillExists = await prisma.document.findUnique({ where: { id: docB.id } });
    expect(stillExists).not.toBeNull();
  });

  it('list returns only requesting user\'s own docs', async () => {
    const res = await agent.get('/api/documents').set(...Object.entries(authHeader(userA as any))[0] as any);
    const returnedIds = res.body.data.map((d: any) => d.id);
    expect(returnedIds).toContain(docA.id);
    expect(returnedIds).not.toContain(docB.id);
  });

  it('admin can read any user\'s doc status', async () => {
    const res = await agent.get(`/api/documents/${docB.id}/status`).set(...Object.entries(authHeader(adminUser as any))[0] as any);
    expect(res.status).toBe(200);
  });

  it('admin can delete any user\'s doc', async () => {
    const res = await agent.delete(`/api/documents/${docB.id}`).set(...Object.entries(authHeader(adminUser as any))[0] as any);
    expect(res.status).toBe(204);
  });

  it('expired token returns 401 not 403 on any route', async () => {
    const expiredToken = expiredTokenFor(userA as any);
    const res = await agent.get(`/api/documents/${docA.id}/status`)
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('TOKEN_EXPIRED');
  });

  it('race condition: doc deleted between auth and handler returns 404 not 500', async () => {
    await prisma.document.delete({ where: { id: docA.id } });
    const res = await agent.get(`/api/documents/${docA.id}/status`).set(...Object.entries(authHeader(userA as any))[0] as any);
    expect(res.status).toBe(404);
  });
});
