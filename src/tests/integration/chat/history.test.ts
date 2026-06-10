import { describe, it, expect, beforeEach } from 'vitest';
import { agent, authHeader, prisma } from '../../setup';

describe('GET /api/chat/:sessionId/history', () => {
  let testUser: any;
  let otherUser: any;
  let readyDoc: any;
  let sessionId: string;

  beforeEach(async () => {
    testUser = await prisma.user.create({ data: { name: 'Test User', email: 'test-1780996783.987437-4340909136@example.com' } });
    otherUser = await prisma.user.create({ data: { name: 'Other User', email: 'other-1780996783.98744-4340909136@example.com' } });
    readyDoc = await prisma.document.create({ data: { id: 'doc-ready', userId: testUser.id, status: 'READY', title: 'A', filename: 'A.pdf', mimeType: 'pdf', fileSize: 100, storageKey: 'k' } });
    
    const sessionRes = await agent.post('/api/chat/create').set(...authHeader(testUser)).send({ docIds: [readyDoc.id] });
    sessionId = sessionRes.body.sessionId;

    const messages = [];
    for (let i = 0; i < 60; i++) {
      messages.push({
        id: `msg-${i}`,
        sessionId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message content ${i}`,
        createdAt: new Date(Date.now() - (60 - i) * 1000)
      });
    }
    await prisma.message.createMany({ data: messages });

    // Seed 2 citations linked to messages[1] (first assistant message)
    await prisma.citation.createMany({
      data: [
        { messageId: 'msg-1', docId: readyDoc.id, chunkId: 'c1', pageNumber: 1, excerpt: 'A' },
        { messageId: 'msg-1', docId: readyDoc.id, chunkId: 'c2', pageNumber: 2, excerpt: 'B' }
      ]
    });
  });

  it('returns messages in ascending createdAt order', async () => {
    const res = await agent.get(`/api/chat/${sessionId}/history`).set(...authHeader(testUser));
    expect(res.status).toBe(200);
    const dates = res.body.data.map((m: any) => new Date(m.createdAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it('each message has required shape', async () => {
    const res = await agent.get(`/api/chat/${sessionId}/history`).set(...authHeader(testUser));
    const msg = res.body.data[0];
    expect(msg).toMatchObject({
      id: expect.any(String),
      role: expect.stringMatching(/^(user|assistant)$/),
      content: expect.any(String),
      createdAt: expect.any(String),
      citations: expect.any(Array),
    });
  });

  it('roles alternate user → assistant', async () => {
    const res = await agent.get(`/api/chat/${sessionId}/history`).set(...authHeader(testUser));
    const roles = res.body.data.slice(0, 6).map((m: any) => m.role);
    expect(roles).toEqual(['user','assistant','user','assistant','user','assistant']);
  });

  it('default returns 50 messages with nextCursor', async () => {
    const res = await agent.get(`/api/chat/${sessionId}/history`).set(...authHeader(testUser));
    expect(res.body.data).toHaveLength(50);
    expect(res.body.nextCursor).not.toBeNull();
  });

  it('cursor pagination — second page has no overlap with first', async () => {
    const res = await agent.get(`/api/chat/${sessionId}/history`).set(...authHeader(testUser));
    const cursor = res.body.nextCursor;
    const page2 = await agent
      .get(`/api/chat/${sessionId}/history?cursor=${cursor}`)
      .set(...authHeader(testUser));
    const ids1 = res.body.data.map((m: any) => m.id);
    const ids2 = page2.body.data.map((m: any) => m.id);
    expect(ids1).not.toEqual(expect.arrayContaining(ids2));
    expect(page2.body.data).toHaveLength(10); // remaining 10
  });

  it('assistant messages include citations', async () => {
    const res = await agent.get(`/api/chat/${sessionId}/history`).set(...authHeader(testUser));
    const assistantMsg = res.body.data.find((m: any) => m.role === 'assistant');
    expect(assistantMsg!.citations).toBeDefined();
    expect(Array.isArray(assistantMsg!.citations)).toBe(true);
  });

  it('empty session returns { data: [], nextCursor: null }', async () => {
    const emptySessionRes = await agent.post('/api/chat/create').set(...authHeader(testUser)).send({ docIds: [readyDoc.id] });
    const emptySession = emptySessionRes.body;
    const res = await agent.get(`/api/chat/${emptySession.sessionId}/history`).set(...authHeader(testUser));
    expect(res.body).toEqual({ data: [], nextCursor: null });
  });

  it('other user session returns 403', async () => {
    const res = await agent.get(`/api/chat/${sessionId}/history`).set(...authHeader(otherUser));
    expect(res.status).toBe(403);
  });
});
