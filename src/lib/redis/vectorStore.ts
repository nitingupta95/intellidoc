import { getRedisClient } from './client';

export interface EmbeddedChunk {
  id: string;
  docId: string;
  userId: string;
  text: string;
  pageNum: number;
  chunkIdx: number;
  embedding: number[];
}

export interface RetrievedChunk extends Omit<EmbeddedChunk, 'embedding'> {
  score: number;
}

export class VectorStoreError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'VectorStoreError';
  }
}

/**
 * Converts a regular JS array of numbers to a Float32Array Buffer.
 * RediSearch expects raw bytes in little-endian float32 format for vector fields.
 */
function float32Buffer(arr: number[]): Buffer {
  return Buffer.from(new Float32Array(arr).buffer);
}

/**
 * Ingests an array of document chunks into Redis Hashes using a pipeline
 * for optimal performance.
 */
export async function ingestChunks(
  docId: string,
  userId: string,
  chunks: EmbeddedChunk[]
): Promise<void> {
  try {
    const client = await getRedisClient();
    const pipeline = client.pipeline();

    for (const chunk of chunks) {
      const key = `doc:chunk:${chunk.id}`;
      // Store all required fields as strings or buffers so Redis Hash can accept them
      pipeline.hset(key, {
        docId: docId,
        userId: userId,
        text: chunk.text,
        pageNum: chunk.pageNum.toString(),
        chunkIdx: chunk.chunkIdx.toString(),
        embedding: float32Buffer(chunk.embedding),
      });
    }

    await pipeline.exec();
  } catch (err) {
    throw new VectorStoreError(`Failed to ingest chunks for document ${docId}`, err);
  }
}

/**
 * Performs a KNN vector search on the Redis index.
 */
export async function similaritySearch(
  queryEmbedding: number[],
  docIds: string[],
  userId: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  try {
    const client = await getRedisClient();

    // Construct the filter
    // e.g., (@userId:{userId} @docId:{id1|id2})
    const escapedUserId = userId.replace(/([\\.\-\@])/g, '\\$1');
    const escapedDocIds = docIds.map(id => id.replace(/([\\.\-\@])/g, '\\$1')).join('|');
    
    // KNN query syntax for RediSearch 2.4+
    const searchQuery = `(@userId:{${escapedUserId}} @docId:{${escapedDocIds}})=>[KNN ${topK} @embedding $BLOB AS score]`;

    const blob = float32Buffer(queryEmbedding);

    // Using raw call to FT.SEARCH for ioredis
    // FT.SEARCH idx:chunks "..." PARAMS 2 BLOB <buffer> DIALECT 2 SORTBY score RETURN 6 docId userId text pageNum chunkIdx score
    const result: any = await client.call(
      'FT.SEARCH',
      'idx:chunks',
      searchQuery,
      'PARAMS', '2', 'BLOB', blob,
      'SORTBY', 'score',
      'DIALECT', '2',
      'RETURN', '6', 'docId', 'userId', 'text', 'pageNum', 'chunkIdx', 'score'
    );

    // result format for FT.SEARCH in ioredis:
    // [ total_results, "doc:chunk:1", ["docId", "abc", "score", "0.1", ...], "doc:chunk:2", ["docId", "def", ...], ... ]
    
    const retrievedChunks: RetrievedChunk[] = [];
    
    if (Array.isArray(result) && result.length > 1) {
      const totalResults = result[0]; // Number
      for (let i = 1; i < result.length; i += 2) {
        const key = result[i] as string;
        const fieldsArray = result[i + 1] as any[];
        
        // Convert fieldsArray like ["docId", "val1", "text", "val2"] to an object
        const fields: Record<string, string> = {};
        for (let j = 0; j < fieldsArray.length; j += 2) {
          fields[fieldsArray[j].toString()] = fieldsArray[j + 1].toString();
        }

        retrievedChunks.push({
          id: key.replace('doc:chunk:', ''),
          docId: fields.docId,
          userId: fields.userId,
          text: fields.text,
          pageNum: parseInt(fields.pageNum, 10),
          chunkIdx: parseInt(fields.chunkIdx, 10),
          score: parseFloat(fields.score),
        });
      }
    }

    return retrievedChunks;
  } catch (err) {
    throw new VectorStoreError('Failed to execute similarity search', err);
  }
}

/**
 * Deletes all chunks associated with a specific document.
 */
export async function deleteDocumentChunks(docId: string): Promise<void> {
  try {
    const client = await getRedisClient();
    
    const escapedDocId = docId.replace(/([\\.\-\@])/g, '\\$1');
    let offset = 0;
    const limit = 100;
    let keepScanning = true;
    
    const keysToDelete: string[] = [];

    while (keepScanning) {
      // FT.SEARCH idx:chunks "@docId:{id}" LIMIT 0 100 RETURN 0
      const result: any = await client.call(
        'FT.SEARCH',
        'idx:chunks',
        `@docId:{${escapedDocId}}`,
        'LIMIT', offset.toString(), limit.toString(),
        'RETURN', '0'
      );

      // result format with RETURN 0: [ total_results, "key1", "key2", ... ]
      if (Array.isArray(result) && result.length > 1) {
        for (let i = 1; i < result.length; i++) {
          keysToDelete.push(result[i] as string);
        }

        if (result.length - 1 < limit) {
          keepScanning = false;
        } else {
          offset += limit;
        }
      } else {
        keepScanning = false;
      }
    }

    if (keysToDelete.length > 0) {
      const pipeline = client.pipeline();
      for (const key of keysToDelete) {
        pipeline.del(key);
      }
      await pipeline.exec();
    }
  } catch (err) {
    throw new VectorStoreError(`Failed to delete chunks for document ${docId}`, err);
  }
}
