import { describe, it, expect, beforeEach, vi } from 'vitest';
import { agent, authHeader, prisma } from '../../setup';
import { parseSseResponse, parseRawSse, getSseWarning } from '../../helpers/parseSse';
import { scoreHallucination } from '@/lib/hallucination';

vi.mock('@/lib/hallucination', () => ({
  scoreHallucination: vi.fn().mockResolvedValue(0.1)
}));

describe('Hallucination Warning Event', () => {
  let testUser: any;
  let readyDoc: any;
  let sessionId: string;

  beforeEach(async () => {
    testUser = await prisma.user.create({ data: { name: 'Test User', email: 'test-1780996783.988294-4339044624@example.com' } });
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

  it('no warning event when score is below threshold (0.1)', async () => {
    vi.mocked(scoreHallucination).mockResolvedValueOnce(0.1);
    const res = await sendMessage(sessionId, 'safe question');
    const events = parseSseResponse(res.text || res.body);
    const warning = getSseWarning(events);
    expect(warning).toBeNull();
  });

  it('warning event emitted when score equals threshold (0.3)', async () => {
    vi.mocked(scoreHallucination).mockResolvedValueOnce(0.3);
    const res = await sendMessage(sessionId, 'risky question');
    const events = parseSseResponse(res.text || res.body);
    const warning = getSseWarning(events);
    expect(warning).not.toBeNull();
    expect(warning).toMatchObject({ score: 0.3, threshold: 0.3 });
  });

  it('warning event emitted when score is above threshold (0.8)', async () => {
    vi.mocked(scoreHallucination).mockResolvedValueOnce(0.8);
    const res = await sendMessage(sessionId, 'hallucinated answer');
    const events = parseSseResponse(res.text || res.body);
    expect(getSseWarning(events)).not.toBeNull();
  });

  it('warning event appears BEFORE done event in stream', async () => {
    vi.mocked(scoreHallucination).mockResolvedValueOnce(0.5);
    const res = await sendMessage(sessionId, 'question');
    const events = parseSseResponse(res.text || res.body);
    const warningIdx = events.findIndex(e => e.type === 'warning');
    const doneIdx    = events.findIndex(e => e.type === 'done');
    expect(warningIdx).toBeGreaterThan(-1);
    expect(warningIdx).toBeLessThan(doneIdx);
  });

  it('stream always ends with done event even after warning', async () => {
    vi.mocked(scoreHallucination).mockResolvedValueOnce(0.9);
    const res = await sendMessage(sessionId, 'question');
    const events = parseSseResponse(res.text || res.body);
    expect(events[events.length - 1].type).toBe('done');
  });

  it('warning flag stored on assistant message in DB', async () => {
    vi.mocked(scoreHallucination).mockResolvedValueOnce(0.7);
    await sendMessage(sessionId, 'question');
    await new Promise(r => setTimeout(r, 50));
    const msg = await prisma.message.findFirst({ where: { sessionId, role: 'assistant' } });
    expect(msg!.hallucinationScore).toBeCloseTo(0.7, 2);
    expect(msg!.hasWarning).toBe(true);
  });

  it('stream continues without warning when scorer throws', async () => {
    vi.mocked(scoreHallucination).mockRejectedValueOnce(new Error('scorer unavailable'));
    const res = await sendMessage(sessionId, 'question');
    const events = parseSseResponse(res.text || res.body);
    expect(events[events.length - 1].type).toBe('done');
    expect(getSseWarning(events)).toBeNull();
  });
});
