import { Router } from 'express';
import { prisma } from '../lib/db';
import { authMiddleware } from '../middleware/authMiddleware';
import multer from 'multer';
import { uploadFile, deleteFile } from '../lib/storage';
import { ingestionQueue } from '../lib/queue';
import { qdrant } from '../lib/vectorStore';
import crypto from 'crypto';

export const documentsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    // Validate MIME types based on magic bytes/multer check
    const validMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (validMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('UNSUPPORTED_TYPE'));
    }
  }
});

documentsRouter.post('/upload', authMiddleware, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.message === 'UNSUPPORTED_TYPE') return res.status(415).json({ error: 'UNSUPPORTED_TYPE' });
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'FILE_TOO_LARGE' });
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'NO_FILE' });
    }

    const userId = req.user.sub;
    const file = req.file;

    // Generate storage key
    const key = `users/${userId}/${crypto.randomUUID()}-${file.originalname}`;
    
    // Upload to storage
    const storageKey = await uploadFile(file.buffer, key);

    // Create DB Record
    const doc = await prisma.document.create({
      data: {
        userId,
        filename: file.originalname,
        mimeType: file.mimetype,
        storageKey,
        status: 'PENDING'
      }
    });

    // Enqueue job
    const job = await ingestionQueue.add('ingest', { docId: doc.id, userId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 }
    });

    await prisma.document.update({
      where: { id: doc.id },
      data: { jobId: job.id }
    });

    res.status(201).json({ docId: doc.id, status: 'PENDING' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

documentsRouter.get('/', authMiddleware, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const limit = parseInt(req.query.limit as string) || 20;
    const cursor = req.query.cursor as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const where: any = { userId };
    if (status) where.status = status;
    if (search) {
      where.filename = { contains: search, mode: 'insensitive' };
    }

    const docs = await prisma.document.findMany({
      take: limit + 1, // Fetch one extra to determine nextCursor
      where,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { createdAt: 'desc' }
    });

    let nextCursor = null;
    if (docs.length > limit) {
      const nextItem = docs.pop(); // Remove the extra item
      nextCursor = docs[docs.length - 1].id; // The actual last item of the page
    }

    res.status(200).json({ data: docs, nextCursor });
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

documentsRouter.get('/:id/status', authMiddleware, async (req: any, res: any) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'DOC_NOT_FOUND' });

    // Admin can read anyone's doc status
    if (doc.userId !== req.user.sub && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const payload: any = { status: doc.status, progress: doc.progress };
    
    if (doc.status === 'PENDING') {
      payload.currentStep = null;
    } else if (doc.status === 'INGESTING') {
      payload.currentStep = doc.currentStep;
    } else if (doc.status === 'READY') {
      payload.chunkCount = doc.chunkCount;
      payload.embeddingModel = doc.embeddingModel;
    } else if (doc.status === 'FAILED') {
      payload.error = doc.errorMessage;
      payload.retryAvailable = true;
    } else if (doc.status === 'CANCELLED') {
      payload.retryAvailable = false;
    }

    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

documentsRouter.delete('/:id', authMiddleware, async (req: any, res: any) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'DOC_NOT_FOUND' });

    // Admin can delete anyone's doc
    if (doc.userId !== req.user.sub && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    if (doc.status === 'INGESTING' && doc.jobId) {
      await ingestionQueue.remove(doc.jobId);
    }

    // Best effort cleanup
    try {
      await qdrant.deleteCollection(doc.id);
    } catch (e) {
      console.warn('Qdrant delete failed, skipping', e);
    }
    
    try {
      await deleteFile(doc.storageKey);
    } catch (e) {
      console.warn('Storage delete failed, skipping', e);
    }

    await prisma.document.delete({ where: { id: doc.id } });
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});
