import { describe, it, expect, beforeEach, vi } from 'vitest';
import { agent, authHeader, prisma } from '../../setup';
import { parseSseResponse, parseRawSse, getSseText, getSseDone } from '../../helpers/parseSse';

vi.mock('@/lib/langchain', () => ({
  buildRagChain: vi.fn().mockReturnValue({
    stream: vi.fn().mockImplementation(async () => {
      async function* generate() {
        for (const chunk of ['Hello', ' from', ' IntelliDoc', ' AI', '!']) {
          yield { text: chunk }
        }
      }
      return generate();
    })
  })
}));

vi.mock('@/lib/vectorStore', () => ({
  retrieveChunks: vi.fn().mockResolvedValue([
    { id: 'chunk-1', text: 'Source text one.', docId: 'doc-ready', pageNumber: 1 },
    { id: 'chunk-2', text: 'Source text two.', docId: 'doc-ready', pageNumber: 3 },
  ])
}));

describe('POST /api/chat/:sessionId/message', () => {
  let testUser: any;
  let otherUser: any;
  let readyDoc: any;
  let sessionId: string;

  beforeEach(async () => {
    testUser = await prisma.user.create({ data: { name: 'Test User', email: 'test-1780996783.9878871-4340909328@example.com' } });
    otherUser = await prisma.user.create({ data: { name: 'Other User', email: 'other-1780996783.98789-4340909328@example.com' } });
    readyDoc = await prisma.document.create({ data: { id: 'doc-ready', userId: testUser.id, status: 'READY', title: 'A', filename: 'A.pdf', mimeType: 'pdf', fileSize: 100, storageKey: 'k' } });
    
    const sessionRes = await agent.post('/api/chat/create')
      .set(...authHeader(testUser)).send({ docIds: [readyDoc.id] });
    sessionId = sessionRes.body.sessionId;
  });

  it('responds with text/event-stream content-type', async () => {
    const res = await agent
      .post(`/api/chat/${sessionId}/message`)
      .set(...authHeader(testUser))
      .set('Accept', 'text/event-stream')
      .send({ message: 'What is this document about?' })
      .buffer(true).parse(parseRawSse);
    expect(res.headers['content-type']).toContain('text/event-stream');
  });

  it('emits start → delta(s) → done in order', async () => {
    const res = await agent.post(`/api/chat/${sessionId}/message`)
      .set(...authHeader(testUser)).set('Accept', 'text/event-stream')
      .send({ message: 'What is this document about?' }).buffer(true).parse(parseRawSse);
    
    const events = parseSseResponse(res.text || res.body);
    expect(events[0].type).toBe('start');
    expect(events[0].data.sessionId).toBe(sessionId);
    const deltas = events.filter(e => e.type === 'delta');
    expect(deltas.length).toBeGreaterThan(0);
    expect(events[events.length - 1].type).toBe('done');
  });

  it('assembled delta text matches mock output', async () => {
    const res = await agent.post(`/api/chat/${sessionId}/message`)
      .set(...authHeader(testUser)).set('Accept', 'text/event-stream')
      .send({ message: 'What is this document about?' }).buffer(true).parse(parseRawSse);
    
    const events = parseSseResponse(res.text || res.body);
    const text = getSseText(events);
    expect(text).toBe('Hello from IntelliDoc AI!');
  });

  it('done event contains tokenCount and citations', async () => {
    const res = await agent.post(`/api/chat/${sessionId}/message`)
      .set(...authHeader(testUser)).set('Accept', 'text/event-stream')
      .send({ message: 'What is this document about?' }).buffer(true).parse(parseRawSse);
    
    const events = parseSseResponse(res.text || res.body);
    const done = getSseDone(events);
    expect(done).toMatchObject({
      tokenCount: expect.any(Number),
      citations: expect.any(Array)
    });
  });

  it('message and assistant response saved to DB', async () => {
    await agent.post(`/api/chat/${sessionId}/message`)
      .set(...authHeader(testUser)).set('Accept', 'text/event-stream')
      .send({ message: 'What is this document about?' }).buffer(true).parse(parseRawSse);

    // Wait a tick for async DB write after stream close
    await new Promise(r => setTimeout(r, 50));
    const messages = await prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hello from IntelliDoc AI!');
  });

  it('returns 422 for empty message', async () => {
    const res = await agent.post(`/api/chat/${sessionId}/message`)
      .set(...authHeader(testUser)).send({ message: '' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('EMPTY_MESSAGE');
  });

  it('returns 404 for unknown sessionId', async () => {
    const res = await agent.post('/api/chat/ghost-session/message')
      .set(...authHeader(testUser)).send({ message: 'hello' });
    expect(res.status).toBe(404);
  });

  it('returns 403 for other user\'s session', async () => {
    const res = await agent.post(`/api/chat/${sessionId}/message`)
      .set(...authHeader(otherUser)).send({ message: 'hello' });
    expect(res.status).toBe(403);
  });
});
