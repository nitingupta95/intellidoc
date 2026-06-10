import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('../../../lib/vectorStore', () => ({
  qdrant: { deleteCollection: vi.fn().mockResolvedValue(undefined) }
}));
vi.mock('../../../lib/storage', () => ({
  deleteFile: vi.fn().mockResolvedValue(undefined),
  uploadFile: vi.fn().mockResolvedValue('https://cdn.test/doc.pdf')
}));
vi.mock('../../../lib/queue', () => ({
  ingestionQueue: { 
    add: vi.fn(), 
    remove: vi.fn().mockResolvedValue(undefined) 
  }
}));

import { createTestApp, truncateAllTables, seedUser } from '../../helpers/createTestApp';
import { qdrant } from '../../../lib/vectorStore';
import { deleteFile } from '../../../lib/storage';
import { ingestionQueue } from '../../../lib/queue';
import { authHeader } from '../../factories/auth.factory';

describe('DELETE /api/documents/:id', () => {
  let app: any, prisma: any, agent: any;
  let testUser: any, otherUser: any;

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
    vi.clearAllMocks();
  });

  it('deletes READY doc — removes DB row, calls Qdrant and storage', async () => {
    const doc = await prisma.document.create({ data: { ...baseDoc(testUser.id), status: 'READY' }});
    const res = await agent.delete(`/api/documents/${doc.id}`).set(...Object.entries(authHeader(testUser as any))[0] as any);
    
    expect(res.status).toBe(204);
    
    const found = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(found).toBeNull();
    
    expect(qdrant.deleteCollection).toHaveBeenCalledWith(doc.id);
    expect(deleteFile).toHaveBeenCalledWith(doc.storageKey);
  });

  it('cascades deletion to associated ChatSessions', async () => {
    const doc = await prisma.document.create({ data: { ...baseDoc(testUser.id), status: 'READY' }});
    await prisma.chatSession.createMany({ data: [
      { id: 'sess-1', userId: testUser.id, documentId: doc.id },
      { id: 'sess-2', userId: testUser.id, documentId: doc.id },
    ]});
    
    await agent.delete(`/api/documents/${doc.id}`).set(...Object.entries(authHeader(testUser as any))[0] as any);
    
    const sessions = await prisma.chatSession.findMany({ where: { documentId: doc.id } });
    expect(sessions).toHaveLength(0);
  });

  it('cancels BullMQ job when doc is INGESTING', async () => {
    const doc = await prisma.document.create({ data: { ...baseDoc(testUser.id), status: 'INGESTING', jobId: 'job-001' }});
    await agent.delete(`/api/documents/${doc.id}`).set(...Object.entries(authHeader(testUser as any))[0] as any);
    
    expect(ingestionQueue.remove).toHaveBeenCalledWith('job-001');
  });

  it('returns 404 for non-existent doc', async () => {
    const res = await agent.delete('/api/documents/ghost-id').set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.status).toBe(404);
  });

  it('returns 403 for another user\'s doc — doc NOT deleted', async () => {
    const otherDoc = await prisma.document.create({ data: { ...baseDoc(otherUser.id), id: 'other-doc' }});
    const res = await agent.delete(`/api/documents/${otherDoc.id}`).set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.status).toBe(403);
    
    const still = await prisma.document.findUnique({ where: { id: otherDoc.id } });
    expect(still).not.toBeNull();
  });

  it('still deletes DB row if Qdrant delete throws', async () => {
    const doc = await prisma.document.create({ data: { ...baseDoc(testUser.id), status: 'READY' }});
    (qdrant.deleteCollection as any).mockRejectedValueOnce(new Error('Qdrant unavailable'));
    
    const res = await agent.delete(`/api/documents/${doc.id}`).set(...Object.entries(authHeader(testUser as any))[0] as any);
    expect(res.status).toBe(204);
    
    const found = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(found).toBeNull();
  });
});
