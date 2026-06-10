import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestApp, truncateAllTables, seedUser } from '../../helpers/createTestApp';
import { authHeader } from '../../factories/auth.factory';

describe('GET /api/documents/:id/status', () => {
  let app: any, prisma: any, agent: any;
  let testUser: any, otherUser: any;
  let doc: any;

  const baseDoc = (userId: string) => ({
    id: 'doc-status-001', 
    userId,
    filename: 'test.pdf', 
    mimeType: 'application/pdf',
    storageKey: 'key/test.pdf', 
    status: 'PENDING',
  });

  beforeAll(async () => {
    ({ app, prisma, agent } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    testUser = await seedUser(prisma);
    otherUser = await seedUser(prisma);
    doc = await prisma.document.create({ data: baseDoc(testUser.id) });
  });

  it('PENDING status response', async () => {
    const res = await agent.get(`/api/documents/${doc.id}/status`).set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'PENDING', progress: 0, currentStep: null });
  });

  it('INGESTING status with progress and currentStep', async () => {
    await prisma.document.update({ 
      where: { id: doc.id }, 
      data: { status: 'INGESTING', progress: 45, currentStep: 'EMBEDDING' }
    });
    const res = await agent.get(`/api/documents/${doc.id}/status`).set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.body).toMatchObject({ status: 'INGESTING', progress: 45, currentStep: 'EMBEDDING' });
  });

  it('READY status with chunkCount and embeddingModel', async () => {
    await prisma.document.update({ 
      where: { id: doc.id }, 
      data: { status: 'READY', progress: 100, chunkCount: 42, embeddingModel: 'text-embedding-3-small' }
    });
    const res = await agent.get(`/api/documents/${doc.id}/status`).set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.body).toMatchObject({
      status: 'READY', progress: 100, chunkCount: 42, embeddingModel: 'text-embedding-3-small'
    });
  });

  it('FAILED status with error message and retryAvailable', async () => {
    await prisma.document.update({ 
      where: { id: doc.id }, 
      data: { status: 'FAILED', errorMessage: 'Embedding service timeout', progress: 30 }
    });
    const res = await agent.get(`/api/documents/${doc.id}/status`).set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.body).toMatchObject({
      status: 'FAILED', error: 'Embedding service timeout', retryAvailable: true
    });
  });

  it('CANCELLED status has retryAvailable: false', async () => {
    await prisma.document.update({ 
      where: { id: doc.id }, 
      data: { status: 'CANCELLED' }
    });
    const res = await agent.get(`/api/documents/${doc.id}/status`).set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.body.retryAvailable).toBe(false);
  });

  it('returns 404 for non-existent doc id', async () => {
    const res = await agent.get('/api/documents/nonexistent-id/status').set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('DOC_NOT_FOUND');
  });

  it('returns 403 for another user\'s document', async () => {
    const otherDoc = await prisma.document.create({ data: { ...baseDoc(otherUser.id), id: 'doc-other' }});
    const res = await agent.get(`/api/documents/${otherDoc.id}/status`).set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.status).toBe(403);
  });
});
