import { describe, it, expect, beforeEach, vi } from 'vitest';
import { agent, authHeader, prisma } from '../../setup';
import { parseSseResponse, parseRawSse, getSseDone } from '../../helpers/parseSse';

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

describe('Full conversation flow (Smoke Test)', () => {
  let testUser: any;
  let readyDoc: any;

  beforeEach(async () => {
    testUser = await prisma.user.create({ data: { name: 'Test User', email: 'test-1780996783.986911-4340908944@example.com' } });
    readyDoc = await prisma.document.create({ data: { id: 'doc-ready', userId: testUser.id, status: 'READY', title: 'A', filename: 'A.pdf', mimeType: 'pdf', fileSize: 100, storageKey: 'k' } });
  });

  async function sendTurn(sessionId: string, message: string) {
    const res = await agent
      .post(`/api/chat/${sessionId}/message`)
      .set(...authHeader(testUser))
      .set('Accept', 'text/event-stream')
      .send({ message })
      .buffer(true).parse(parseRawSse);
    return parseSseResponse(res.text || res.body);
  }

  it('completes a 3-turn conversation with history', async () => {
    // Step 1: create session
    const createRes = await agent.post('/api/chat/create')
      .set(...authHeader(testUser)).send({ docIds: [readyDoc.id] });
    expect(createRes.status).toBe(201);
    const { sessionId } = createRes.body;

    // Step 2: send 3 messages
    const questions = ['What is this doc about?', 'Summarise section 2.', 'List the key findings.'];
    const allDone = [];
    for (const q of questions) {
      const events = await sendTurn(sessionId, q);
      expect(events[events.length - 1].type).toBe('done');
      allDone.push(getSseDone(events));
    }

    // Step 3: each done event has its own tokenCount
    for (const done of allDone) {
      expect((done as any).tokenCount).toBeGreaterThan(0);
    }

    // Step 4: history returns all 6 messages (3 user + 3 assistant)
    await new Promise(r => setTimeout(r, 100));
    const histRes = await agent.get(`/api/chat/${sessionId}/history`)
      .set(...authHeader(testUser));
    expect(histRes.status).toBe(200);
    expect(histRes.body.data).toHaveLength(6);

    // Step 5: history in correct order
    const roles = histRes.body.data.map((m: any) => m.role);
    expect(roles).toEqual(['user','assistant','user','assistant','user','assistant']);

    // Step 6: all assistant messages have citations
    const assistants = histRes.body.data.filter((m: any) => m.role === 'assistant');
    for (const a of assistants) {
      expect(Array.isArray(a.citations)).toBe(true);
    }
  });
});
