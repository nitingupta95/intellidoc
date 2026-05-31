import { db } from '../../db';
import { ingestChunks, type EmbeddedChunk } from '../../redis/vectorStore';
import { RecursiveCharacterTextSplitter, type TextChunk } from './chunking/textSplitter';
import { CodeSplitter, type SupportedLanguage } from './chunking/codeSplitter';
import { embedChunks } from './embedding';
import pino from 'pino';
import * as mammoth from 'mammoth';
const pdfParse = require('pdf-parse');

const logger = pino({ name: 'ingestion-pipeline' });

export type IngestStage = 'PARSING' | 'CHUNKING' | 'EMBEDDING' | 'INDEXING' | 'COMPLETE';

/**
 * Placeholder for fetching files from storage.
 * In a real application, implement this to download the S3 object to a Buffer.
 */
async function fetchFileFromStorage(s3Key: string): Promise<Buffer> {
  // TODO: Replace with actual S3 fetch logic
  throw new Error('fetchFileFromStorage not implemented. Please provide S3 fetch logic.');
}

export async function ingestDocument(
  docId: string,
  userId: string,
  s3Key: string,
  mimeType: string,
  onProgress: (stage: IngestStage, pct: number) => void
): Promise<void> {
  try {
    // ---------------------------------------------------------
    // STAGE 1: PARSING (0-20%)
    // ---------------------------------------------------------
    onProgress('PARSING', 0);
    logger.info({ docId, s3Key }, 'Fetching file from storage');
    
    // Fetch buffer
    const fileBuffer = await fetchFileFromStorage(s3Key);
    onProgress('PARSING', 5);

    let rawText = '';
    
    // Extract Text based on MimeType
    if (mimeType === 'application/pdf') {
      // PDF Parsing wrapped in a promise to not block the event loop entirely
      rawText = await new Promise<string>((resolve, reject) => {
        pdfParse(fileBuffer)
          .then((data: any) => resolve(data.text))
          .catch((err: any) => reject(err));
      });
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      mimeType === 'application/msword'
    ) {
      // DOCX Parsing
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      rawText = result.value;
    } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      // Raw Text / Code
      rawText = fileBuffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported mime type for parsing: ${mimeType}`);
    }

    if (!rawText.trim()) {
      throw new Error('Extracted text is empty.');
    }
    onProgress('PARSING', 20);

    // ---------------------------------------------------------
    // STAGE 2: CHUNKING (20-40%)
    // ---------------------------------------------------------
    onProgress('CHUNKING', 20);
    let chunks: TextChunk[] = [];

    // Map MIME types to code splitter languages if applicable
    const codeMap: Record<string, SupportedLanguage> = {
      'text/typescript': 'typescript',
      'application/typescript': 'typescript',
      'text/javascript': 'javascript',
      'application/javascript': 'javascript',
      'text/x-python': 'python',
      'text/x-go': 'go',
      'text/rust': 'rust',
    };

    if (codeMap[mimeType]) {
      const language = codeMap[mimeType];
      const splitter = new CodeSplitter(language);
      chunks = splitter.split(rawText, s3Key);
    } else {
      const splitter = new RecursiveCharacterTextSplitter();
      // For basic text, we mock pageNum as 1. For PDFs, we could have extracted actual pages
      // but standard pdf-parse groups it all into one string. 
      // A more robust implementation would use pdf-parse pagerender to track page numbers.
      chunks = splitter.split(rawText, 1);
    }

    onProgress('CHUNKING', 40);

    // ---------------------------------------------------------
    // STAGE 3: EMBEDDING (40-80%)
    // ---------------------------------------------------------
    onProgress('EMBEDDING', 40);
    
    const textsToEmbed = chunks.map(c => c.text);
    
    // embedChunks handles batching of 100, retries, and caching
    const vectors = await embedChunks(textsToEmbed, docId);
    
    onProgress('EMBEDDING', 80);

    // ---------------------------------------------------------
    // STAGE 4: INDEXING (80-95%)
    // ---------------------------------------------------------
    onProgress('INDEXING', 80);
    
    const embeddedChunks: EmbeddedChunk[] = chunks.map((chunk, i) => ({
      id: `${docId}:${chunk.chunkIdx}`,
      docId,
      userId,
      text: chunk.text,
      pageNum: chunk.pageNum,
      chunkIdx: chunk.chunkIdx,
      embedding: vectors[i],
    }));

    await ingestChunks(docId, userId, embeddedChunks);
    
    onProgress('INDEXING', 95);

    // ---------------------------------------------------------
    // STAGE 5: COMPLETE (100%)
    // ---------------------------------------------------------
    onProgress('COMPLETE', 95);
    
    // Update Document in PostgreSQL
    await db.document.update({
      where: { id: docId },
      data: {
        status: 'READY',
        // Assuming chunkCount is a valid field on the model; if not, you may need to add it or remove this line.
        // chunkCount: embeddedChunks.length, 
        updatedAt: new Date(),
      },
    });

    onProgress('COMPLETE', 100);
    logger.info({ docId, totalChunks: embeddedChunks.length }, 'Ingestion pipeline completed successfully');

  } catch (error: any) {
    logger.error({ error, docId }, 'Ingestion pipeline failed');
    
    // Update database status to FAILED
    try {
      await db.document.update({
        where: { id: docId },
        data: {
          status: 'FAILED',
          updatedAt: new Date(),
        },
      });
    } catch (dbError) {
      logger.error({ dbError, docId }, 'Failed to update document status to FAILED');
    }

    throw new Error(`Ingestion failed for doc ${docId}: ${error.message}`);
  }
}
