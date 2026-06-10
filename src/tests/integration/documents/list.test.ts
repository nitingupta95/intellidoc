import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestApp, truncateAllTables, seedUser } from '../../helpers/createTestApp';
import { signedTokensFor, authHeader } from '../../factories/auth.factory';

describe('GET /api/documents', () => {
  let app: any, prisma: any, agent: any;
  let testUser: any, otherUser: any;

  beforeAll(async () => {
    ({ app, prisma, agent } = await createTestApp());
  });

  async function seedDocs(prisma: any, userId: string, overrides: any[] = []) {
    return prisma.document.createMany({ 
      data: overrides.map((o, i) => ({
        id: `doc-${userId}-${i}`, 
        userId, 
        filename: `doc-${i}.pdf`,
        mimeType: 'application/pdf', 
        status: 'PENDING', 
        storageKey: `key-${i}`,
        ...o
      })) 
    });
  }

  beforeEach(async () => {
    await truncateAllTables(prisma);
    testUser = await seedUser(prisma);
    otherUser = await seedUser(prisma);

    const testUserDocs = [
      ...Array(10).fill({ status: 'READY' }).map((d, i) => i < 3 ? { ...d, filename: `invoice-${i}.pdf` } : d),
      ...Array(10).fill({ status: 'PENDING' }),
      ...Array(5).fill({ status: 'FAILED' })
    ];
    
    await seedDocs(prisma, testUser.id, testUserDocs);
    await seedDocs(prisma, otherUser.id, Array(5).fill({ status: 'READY' }));
  });

  it('returns paginated list with nextCursor', async () => {
    const res = await agent.get('/api/documents').set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.nextCursor).not.toBeNull();
  });

  it('respects ?limit param', async () => {
    const res = await agent.get('/api/documents?limit=5').set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.body.data).toHaveLength(5);
  });

  it('cursor pagination returns correct next page', async () => {
    const page1 = await agent.get('/api/documents?limit=10').set(...Object.entries(authHeader(testUser as any))[0] as any);
    const cursor = page1.body.nextCursor;
    
    const page2 = await agent.get(`/api/documents?limit=10&cursor=${cursor}`).set(...Object.entries(authHeader(testUser as any))[0] as any);
    
    const ids1 = page1.body.data.map((d: any) => d.id);
    const ids2 = page2.body.data.map((d: any) => d.id);
    expect(ids1).not.toEqual(expect.arrayContaining(ids2));
  });

  it('filters by status=READY', async () => {
    const res = await agent.get('/api/documents?status=READY').set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.body.data.every((d: any) => d.status === 'READY')).toBe(true);
    expect(res.body.data).toHaveLength(10);
  });

  it('full-text search filters by filename', async () => {
    const res = await agent.get('/api/documents?search=invoice').set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.every((d: any) => d.filename.includes('invoice'))).toBe(true);
  });

  it('user isolation — never returns other user docs', async () => {
    const res = await agent.get('/api/documents').set(...Object.entries(authHeader(testUser as any))[0] as any);
    const ids = res.body.data.map((d: any) => d.userId);
    expect(ids.every((id: string) => id === testUser.id)).toBe(true);
  });

  it('returns empty list when no documents', async () => {
    await truncateAllTables(prisma);
    const res = await agent.get('/api/documents').set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.body).toEqual({ data: [], nextCursor: null });
  });
});
