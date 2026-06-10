import { describe, it, expect, beforeEach } from 'vitest';
import { agent, authHeader, prisma } from '../../setup';

describe('POST /api/chat/:sessionId/feedback', () => {
  let testUser: any;
  let otherUser: any;
  let readyDoc: any;
  let sessionId: string;
  let userMsg: any;
  let assistantMsg: any;

  beforeEach(async () => {
    testUser = await prisma.user.create({ data: { name: 'Test User', email: 'test-1780996783.98721-4340909040@example.com' } });
    otherUser = await prisma.user.create({ data: { name: 'Other User', email: 'other-1780996783.987212-4340909040@example.com' } });
    readyDoc = await prisma.document.create({ data: { id: 'doc-ready', userId: testUser.id, status: 'READY', title: 'A', filename: 'A.pdf', mimeType: 'pdf', fileSize: 100, storageKey: 'k' } });
    
    const sessionRes = await agent.post('/api/chat/create').set(...authHeader(testUser)).send({ docIds: [readyDoc.id] });
    sessionId = sessionRes.body.sessionId;

    userMsg = await prisma.message.create({
      data: { id: 'msg-u', role: 'user', sessionId, content: 'question' }
    });
    assistantMsg = await prisma.message.create({
      data: { id: 'msg-a', role: 'assistant', sessionId, content: 'answer' }
    });
  });

  it('records thumbs_up on assistant message', async () => {
    const res = await agent
      .post(`/api/chat/${sessionId}/feedback`)
      .set(...authHeader(testUser))
      .send({ messageId: assistantMsg.id, rating: 'thumbs_up' });
    expect(res.status).toBe(200);
    const row = await prisma.messageFeedback.findUnique({ where: { messageId: assistantMsg.id } });
    expect(row!.rating).toBe('thumbs_up');
  });

  it('records thumbs_down on assistant message', async () => {
    const res = await agent
      .post(`/api/chat/${sessionId}/feedback`)
      .set(...authHeader(testUser))
      .send({ messageId: assistantMsg.id, rating: 'thumbs_down' });
    expect(res.status).toBe(200);
    const row = await prisma.messageFeedback.findUnique({ where: { messageId: assistantMsg.id } });
    expect(row!.rating).toBe('thumbs_down');
  });

  it('updating feedback replaces existing row, no duplicate', async () => {
    await agent.post(`/api/chat/${sessionId}/feedback`)
      .set(...authHeader(testUser))
      .send({ messageId: assistantMsg.id, rating: 'thumbs_up' });
    await agent.post(`/api/chat/${sessionId}/feedback`)
      .set(...authHeader(testUser))
      .send({ messageId: assistantMsg.id, rating: 'thumbs_down' });
    
    const rows = await prisma.messageFeedback.findMany({ where: { messageId: assistantMsg.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe('thumbs_down');
  });

  it('returns 422 when targeting a user-role message', async () => {
    const res = await agent.post(`/api/chat/${sessionId}/feedback`)
      .set(...authHeader(testUser))
      .send({ messageId: userMsg.id, rating: 'thumbs_up' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('INVALID_TARGET');
  });

  it('returns 403 for message in another user\'s session', async () => {
    const res = await agent.post(`/api/chat/${sessionId}/feedback`)
      .set(...authHeader(otherUser))
      .send({ messageId: assistantMsg.id, rating: 'thumbs_up' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown messageId', async () => {
    const res = await agent.post(`/api/chat/${sessionId}/feedback`)
      .set(...authHeader(testUser))
      .send({ messageId: 'ghost-msg', rating: 'thumbs_up' });
    expect(res.status).toBe(404);
  });

  it('returns 422 when rating field is missing', async () => {
    const res = await agent.post(`/api/chat/${sessionId}/feedback`)
      .set(...authHeader(testUser))
      .send({ messageId: assistantMsg.id });
    expect(res.status).toBe(422);
  });
});
