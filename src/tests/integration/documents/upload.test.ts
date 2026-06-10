import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('../../../lib/storage', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://cdn.test/doc.pdf'),
  deleteFile: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../lib/queue', () => ({
  ingestionQueue: { 
    add: vi.fn().mockResolvedValue({ id: 'job-001' }),
    remove: vi.fn().mockResolvedValue(undefined)
  }
}));

import { createTestApp, truncateAllTables, seedUser } from '../../helpers/createTestApp';
import { uploadFile } from '../../../lib/storage';
import { ingestionQueue } from '../../../lib/queue';
import { fixtures } from '../../helpers/fixtures';
import { signedTokensFor } from '../../factories/auth.factory';

describe('POST /api/documents/upload', () => {
  let app: any, prisma: any, agent: any, testUser: any, accessToken: string;

  beforeAll(async () => {
    ({ app, prisma, agent } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    testUser = await seedUser(prisma);
    accessToken = signedTokensFor(testUser as any).accessToken;
    vi.clearAllMocks();
  });

  const { buffer, name, mime } = fixtures.pdf();

  it('creates document record and enqueues ingestion job', async () => {
    const res = await agent
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', buffer, { filename: name, contentType: mime });
      
    expect(res.status).toBe(201);
    expect(res.body.docId).toBeDefined();
    expect(res.body.status).toBe('PENDING');

    // DB assertion
    const doc = await prisma.document.findUnique({ where: { id: res.body.docId } });
    expect(doc).not.toBeNull();
    expect(doc!.userId).toBe(testUser.id);
    expect(doc!.filename).toBe(name);
    expect(doc!.mimeType).toBe(mime);

    // Queue assertion
    expect(ingestionQueue.add).toHaveBeenCalledOnce();
    expect(ingestionQueue.add).toHaveBeenCalledWith(
      'ingest', 
      { docId: res.body.docId, userId: testUser.id }, 
      expect.any(Object)
    );

    // Storage assertion
    expect(uploadFile).toHaveBeenCalledOnce();
  });

  it('accepts DOCX files', async () => {
    const docx = fixtures.docx();
    const res = await agent
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', docx.buffer, { filename: docx.name, contentType: docx.mime });
    expect(res.status).toBe(201);
  });

  it('accepts TXT files', async () => {
    const txt = fixtures.txt();
    const res = await agent
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', txt.buffer, { filename: txt.name, contentType: txt.mime });
    expect(res.status).toBe(201);
  });

  it('rejects PNG with 415', async () => {
    const res = await agent
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('fake-png'), { filename: 'img.png', contentType: 'image/png' });
      
    expect(res.status).toBe(415);
    expect(res.body.error).toBe('UNSUPPORTED_TYPE');
    
    const count = await prisma.document.count();
    expect(count).toBe(0); // no row created
  });

  it('rejects files over 50MB with 413', async () => {
    const { buffer: big } = fixtures.large(52 * 1024 * 1024);
    const res = await agent
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' });
      
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('FILE_TOO_LARGE');
  });

  it('returns 400 when no file field attached', async () => {
    const res = await agent
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${accessToken}`);
      
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('NO_FILE');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await agent
      .post('/api/documents/upload')
      .attach('file', buffer, { filename: name, contentType: mime });
      
    expect(res.status).toBe(401);
    expect(ingestionQueue.add).not.toHaveBeenCalled();
  });
});
