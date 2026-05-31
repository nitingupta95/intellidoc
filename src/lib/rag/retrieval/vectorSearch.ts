import { getRedisClient } from '../../redis/client';
import type { RetrievedChunk } from '../../redis/vectorStore';
import pino from 'pino';

const logger = pino({ name: 'vector-search' });

export class RetrievalError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'RetrievalError';
  }
}

/**
 * Converts a regular JS array of numbers to a Float32Array Buffer.
 */
function float32Buffer(arr: number[]): Buffer {
  return Buffer.from(new Float32Array(arr).buffer);
}

export interface FullRetrievedChunk extends RetrievedChunk {
  embedding: number[];
}

/**
 * Executes Redis FT.SEARCH with vector KNN.
 * Returns chunks sorted by distance ascending (lower is more similar).
 */
export async function vectorSearch(
  queryEmbedding: number[],
  docIds: string[],
  userId: string,
  topK: number = 20
): Promise<FullRetrievedChunk[]> {
  if (!docIds || docIds.length === 0) {
    logger.info('Empty docIds array provided to vectorSearch, returning []');
    return [];
  }

  let client;
  try {
    client = await getRedisClient();
  } catch (err) {
    throw new RetrievalError('Failed to connect to Redis for vector search', err);
  }

  try {
    // Construct strict filter
    const escapedUserId = userId.replace(/([\\.\-\@])/g, '\\$1');
    const escapedDocIds = docIds.map(id => id.replace(/([\\.\-\@])/g, '\\$1')).join('|');
    
    // KNN query syntax for RediSearch 2.4+
    const searchQuery = `(@userId:{${escapedUserId}} @docId:{${escapedDocIds}})=>[KNN ${topK} @embedding $BLOB AS score]`;
    const blob = float32Buffer(queryEmbedding);

    const result: any = await client.call(
      'FT.SEARCH',
      'idx:chunks',
      searchQuery,
      'PARAMS', '2', 'BLOB', blob,
      'SORTBY', 'score', 'ASC',
      'DIALECT', '2',
      'RETURN', '7', 'docId', 'userId', 'text', 'pageNum', 'chunkIdx', 'score', 'embedding'
    );

    const retrievedChunks: FullRetrievedChunk[] = [];
    
    if (Array.isArray(result) && result.length > 1) {
      for (let i = 1; i < result.length; i += 2) {
        const key = result[i] as string;
        const fieldsArray = result[i + 1] as any[];
        
        const fields: Record<string, string> = {};
        for (let j = 0; j < fieldsArray.length; j += 2) {
          fields[fieldsArray[j].toString()] = fieldsArray[j + 1].toString();
        }

        let embeddingArray: number[] = [];
        if (fields.embedding) {
          const buffer = Buffer.from(fields.embedding, 'binary');
          embeddingArray = Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4));
        }

        retrievedChunks.push({
          id: key.replace('doc:chunk:', ''),
          docId: fields.docId,
          userId: fields.userId,
          text: fields.text,
          pageNum: parseInt(fields.pageNum, 10),
          chunkIdx: parseInt(fields.chunkIdx, 10),
          score: parseFloat(fields.score), // KNN distance (lower is better)
          embedding: embeddingArray,
        });
      }
    }

    return retrievedChunks;
  } catch (err) {
    logger.error({ err, userId }, 'Vector search execution failed');
    throw new RetrievalError('Failed to execute vector similarity search', err);
  }
}
