import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn().mockResolvedValue({
    data: [{ embedding: Array(1536).fill(0.1) }]
  })
}));

vi.mock('openai', () => {
  return {
    default: class OpenAI {
      embeddings = {
        create: mockCreate
      };
    }
  };
});

vi.mock('../../../lib/vectorStore', () => ({
  qdrant: { 
    upsert: vi.fn().mockResolvedValue(undefined),
    deleteCollection: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../../lib/storage', () => ({
  downloadFile: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4\n%%EOF', 'utf-8')),
  uploadFile: vi.fn(),
  deleteFile: vi.fn()
}));

import { createTestApp, truncateAllTables, seedUser } from '../../helpers/createTestApp';
import { processIngestionJob } from '../../../workers/ingestionWorker';
import { qdrant } from '../../../lib/vectorStore';
import OpenAI from 'openai';

describe('Ingestion Worker Pipeline', () => {
  let app: any, prisma: any;
  let testUser: any;
  let doc: any;
  let job: any;
  let openaiClient: any;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    testUser = await seedUser(prisma);
    doc = await prisma.document.create({ data: {
      id: 'doc-ingest-001', userId: testUser.id, filename: 'test.pdf', mimeType: 'application/pdf', storageKey: 'keyA', status: 'PENDING'
    }});
    job = { data: { docId: doc.id, userId: testUser.id } };
    vi.clearAllMocks();
  });

  it('transitions PENDING → INGESTING → READY on success', async () => {
    await processIngestionJob(job);
    const final = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(final!.status).toBe('READY');
    expect(final!.progress).toBe(100);
    expect(final!.chunkCount).toBeGreaterThan(0);
    expect(final!.embeddingModel).toBe('text-embedding-3-small');
  });

  it('stores intermediate INGESTING progress in DB', async () => {
    const updates: number[] = [];
    const originalUpdate = prisma.document.update.bind(prisma.document);
    const spy = vi.spyOn(prisma.document, 'update').mockImplementation(async (args: any) => {
      if (args.data.progress) updates.push(args.data.progress as number);
      return originalUpdate(args);
    });
    await processIngestionJob(job);
    expect(updates).toEqual(expect.arrayContaining([25, 50, 75, 100]));
  });

  it('calls Qdrant upsert with docId as collectionId', async () => {
    await processIngestionJob(job);
    expect(qdrant.upsert).toHaveBeenCalledWith(
      doc.id,
      expect.objectContaining({ points: expect.any(Array) })
    );
  });

  it('sets status to FAILED when OpenAI embedding throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('OpenAI 503'));
    await processIngestionJob(job);
    const failed = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(failed!.status).toBe('FAILED');
    expect(failed!.errorMessage).toContain('OpenAI 503');
  });

  it('sets status to FAILED when Qdrant upsert throws — no partial chunks in DB', async () => {
    (qdrant.upsert as any).mockRejectedValueOnce(new Error('Qdrant write error'));
    await processIngestionJob(job);
    const failed = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(failed!.status).toBe('FAILED');
    const chunks = await prisma.chunk.findMany({ where: { documentId: doc.id } });
    expect(chunks).toHaveLength(0); // rolled back
  });

  it('exits cleanly if doc is deleted mid-ingestion', async () => {
    await prisma.document.delete({ where: { id: doc.id } });
    await expect(processIngestionJob(job)).resolves.not.toThrow();
  });
});
