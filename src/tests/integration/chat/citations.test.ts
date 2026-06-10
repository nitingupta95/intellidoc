import { describe, it, expect, beforeEach, vi } from 'vitest';
import { agent, authHeader, prisma } from '../../setup';
import { parseSseResponse, parseRawSse, getSseDone } from '../../helpers/parseSse';

import { retrieveChunks as _rc } from '@/lib/vectorStore';
const retrieveChunks = _rc as any;
vi.mock('@/lib/vectorStore', () => ({
  retrieveChunks: vi.fn().mockResolvedValue([
    { id: 'chunk-1', text: 'Source text one.', docId: 'doc-ready', pageNumber: 1 },
    { id: 'chunk-2', text: 'Source text two.', docId: 'doc-ready', pageNumber: 3 },
  ])
}));

describe('Citations Shape + Accuracy', () => {
  let testUser: any;
  let readyDoc: any;
  let sessionId: string;
  

  beforeEach(async () => {
    testUser = await prisma.user.create({ data: { name: 'Test User', email: 'test-1780996783.988532-4340909424@example.com' } });
    readyDoc = await prisma.document.create({ data: { id: 'doc-ready', userId: testUser.id, status: 'READY', title: 'A', filename: 'A.pdf', mimeType: 'pdf', fileSize: 100, storageKey: 'k' } });
    const sessionRes = await agent.post('/api/chat/create').set(...authHeader(testUser)).send({ docIds: [readyDoc.id] });
    sessionId = sessionRes.body.sessionId;
    vi.clearAllMocks();
  });

  async function sendMessage(id: string, message: string) {
    return agent.post(`/api/chat/${id}/message`)
      .set(...authHeader(testUser)).set('Accept', 'text/event-stream')
      .send({ message }).buffer(true).parse(parseRawSse);
  }

  it('each citation has required fields with correct types', async () => {
    const res = await sendMessage(sessionId, 'question');
    const events = parseSseResponse(res.text || res.body);
    const done = getSseDone(events) as { tokenCount: number; citations: any[] };
    
    expect(done.citations.length).toBeGreaterThan(0);
    for (const citation of done.citations) {
      expect(citation).toMatchObject({
        docId: expect.any(String),
        chunkId: expect.any(String),
        pageNumber: expect.any(Number),
        excerpt: expect.any(String),
      });
      expect(citation.pageNumber).toBeGreaterThan(0);
      expect(citation.excerpt.length).toBeLessThanOrEqual(200);
      expect(citation.excerpt.length).toBeGreaterThan(0);
    }
  });

  it('citation docId belongs to the session\'s documents', async () => {
    const res = await sendMessage(sessionId, 'question');
    const done = getSseDone(parseSseResponse(res.text || res.body)) as any;
    
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId }, include: { documents: true }
    });
    const sessionDocIds = session!.documents.map(d => d.id);
    for (const citation of done.citations) {
      expect(sessionDocIds).toContain(citation.docId);
    }
  });

  it('citation chunkId matches retriever mock output', async () => {
    const res = await sendMessage(sessionId, 'question');
    const done = getSseDone(parseSseResponse(res.text || res.body)) as any;
    
    const validChunkIds = ['chunk-1', 'chunk-2'];
    for (const citation of done.citations) {
      expect(validChunkIds).toContain(citation.chunkId);
    }
  });

  it('citations persisted to DB linked to assistant message', async () => {
    const res = await sendMessage(sessionId, 'question');
    const done = getSseDone(parseSseResponse(res.text || res.body)) as any;
    
    await new Promise(r => setTimeout(r, 50));
    const assistantMsg = await prisma.message.findFirst({
      where: { sessionId, role: 'assistant' }, include: { citations: true }
    });
    expect(assistantMsg!.citations.length).toBe(done.citations.length);
    expect(assistantMsg!.citations[0]).toMatchObject({
      docId: expect.any(String), chunkId: expect.any(String)
    });
  });

  it('empty retriever result → citations is [] not error', async () => {
    retrieveChunks.mockResolvedValueOnce([]);
    const res = await sendMessage(sessionId, 'question with no context');
    const d = getSseDone(parseSseResponse(res.text || res.body));
    expect((d as any).citations).toEqual([]);
  });

  it('duplicate chunk from retriever → deduplicated in citations', async () => {
    retrieveChunks.mockResolvedValueOnce([
      { id: 'chunk-1', text: 'Source.', docId: readyDoc.id, pageNumber: 1 },
      { id: 'chunk-1', text: 'Source.', docId: readyDoc.id, pageNumber: 1 },
    ]);
    const res = await sendMessage(sessionId, 'question');
    const d = getSseDone(parseSseResponse(res.text || res.body)) as any;
    const ids = d.citations.map((c: any) => c.chunkId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
