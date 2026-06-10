import { describe, it, expect, beforeEach } from 'vitest';
import { agent, authHeader, prisma } from '../../setup';

describe('POST /api/chat/create', () => {
  let testUser: any;
  let otherUser: any;
  let readyDoc: any;
  let pendingDoc: any;
  let otherDoc: any;

  beforeEach(async () => {
    // These would normally be created in a setup hook or here
    // For the sake of the test shape requested:
    testUser = await prisma.user.create({ data: { name: 'Test User', email: 'test-1780996783.987733-4340909232@example.com' } });
    otherUser = await prisma.user.create({ data: { name: 'Other User', email: 'other-1780996783.987735-4340909232@example.com' } });

    readyDoc = await prisma.document.create({ data: { id: 'doc-ready', userId: testUser.id, status: 'READY', title: 'A', filename: 'A.pdf', mimeType: 'pdf', fileSize: 100, storageKey: 'k' } });
    pendingDoc = await prisma.document.create({ data: { id: 'doc-pending', userId: testUser.id, status: 'PENDING', title: 'B', filename: 'B.pdf', mimeType: 'pdf', fileSize: 100, storageKey: 'k2' } });
    otherDoc = await prisma.document.create({ data: { id: 'doc-other', userId: otherUser.id, status: 'READY', title: 'C', filename: 'C.pdf', mimeType: 'pdf', fileSize: 100, storageKey: 'k3' } });
  });

  it('creates session for READY document', async () => {
    const res = await agent
      .post('/api/chat/create')
      .set(...authHeader(testUser))
      .send({ docIds: [readyDoc.id] });
    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.docIds).toContain(readyDoc.id);
    expect(res.body.model).toBeDefined();
    
    // DB check
    const session = await prisma.chatSession.findUnique({ where: { id: res.body.sessionId } });
    expect(session!.userId).toBe(testUser.id);
  });

  it('creates session with multiple READY docs', async () => {
    const doc2 = await prisma.document.create({ data: { id: 'doc-2', userId: testUser.id, status: 'READY', title: 'D', filename: 'D.pdf', mimeType: 'pdf', fileSize: 100, storageKey: 'k4' } });
    const res = await agent
      .post('/api/chat/create')
      .set(...authHeader(testUser))
      .send({ docIds: [readyDoc.id, doc2.id] });
    expect(res.status).toBe(201);
    expect(res.body.docIds).toHaveLength(2);
  });

  it('returns 403 for doc owned by another user', async () => {
    const res = await agent
      .post('/api/chat/create')
      .set(...authHeader(testUser))
      .send({ docIds: [otherDoc.id] });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns 422 for PENDING doc', async () => {
    const res = await agent
      .post('/api/chat/create')
      .set(...authHeader(testUser))
      .send({ docIds: [pendingDoc.id] });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('DOCS_NOT_READY');
  });

  it('returns 422 for each non-ready status', async () => {
    for (const status of ['INGESTING', 'FAILED', 'CANCELLED']) {
      await prisma.document.update({ where: { id: pendingDoc.id }, data: { status } });
      const res = await agent.post('/api/chat/create')
        .set(...authHeader(testUser)).send({ docIds: [pendingDoc.id] });
      expect(res.status).toBe(422);
    }
  });

  it('returns 422 for empty docIds', async () => {
    const res = await agent.post('/api/chat/create')
      .set(...authHeader(testUser)).send({ docIds: [] });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('NO_DOCS');
  });
});
