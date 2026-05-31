import { getRedisClient } from '../../redis/client';
import type { RetrievedChunk } from '../../redis/vectorStore';
import crypto from 'crypto';
import pino from 'pino';

const logger = pino({ name: 'bm25-scorer' });

export interface BM25RetrievedChunk extends RetrievedChunk {
  bm25Score: number;
}

const K1 = 1.5;
const B = 0.75;
const DEFAULT_AVGDL = 250; // Approximated average chunk length in words

/**
 * Basic whitespace and punctuation tokenizer.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Calculates IDF for a given term within a strict document set using RediSearch counts.
 */
async function getTermIDF(
  term: string,
  escapedDocIds: string,
  escapedUserId: string,
  N: number,
  client: any
): Promise<number> {
  try {
    // RediSearch text query syntax: @text:term
    const query = `(@userId:{${escapedUserId}} @docId:{${escapedDocIds}}) (@text:${term})`;
    const result: any = await client.call('FT.SEARCH', 'idx:chunks', query, 'LIMIT', '0', '0');
    const n = Array.isArray(result) && result.length > 0 ? result[0] : 0;

    // Standard BM25 IDF formula
    const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);
    return Math.max(idf, 0.01); // Prevent negative or zero IDF
  } catch (error) {
    logger.error({ term, error }, 'Failed to compute IDF for term');
    return 0;
  }
}

/**
 * Scores retrieved chunks using the BM25 algorithm.
 */
export async function scoreBM25(
  query: string,
  chunks: RetrievedChunk[],
  docIds: string[],
  userId: string
): Promise<BM25RetrievedChunk[]> {
  if (!chunks.length || !docIds.length || !query.trim()) {
    return chunks.map(c => ({ ...c, bm25Score: 0 }));
  }

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return chunks.map(c => ({ ...c, bm25Score: 0 }));
  }

  const client = await getRedisClient();
  const escapedDocIds = docIds.map(id => id.replace(/([\\.\-\@])/g, '\\$1')).join('|');
  const escapedUserId = userId.replace(/([\\.\-\@])/g, '\\$1');

  // Compute a cache key for the IDF values of this specific query and document set
  const docSetString = [...docIds].sort().join(',');
  const queryHash = crypto
    .createHash('sha256')
    .update(`${docSetString}:${userId}:${queryTerms.join(' ')}`)
    .digest('hex');
  const cacheKey = `bm25:idf:${queryHash}`;

  let idfMap: Record<string, number> = {};
  
  // Try to load cached IDFs
  const cached = await client.get(cacheKey);
  if (cached) {
    idfMap = JSON.parse(cached);
  } else {
    // 1. Get total number of chunks (N) in the document set
    const baseQuery = `(@userId:{${escapedUserId}} @docId:{${escapedDocIds}})`;
    let N = 0;
    try {
      const result: any = await client.call('FT.SEARCH', 'idx:chunks', baseQuery, 'LIMIT', '0', '0');
      N = Array.isArray(result) && result.length > 0 ? result[0] : 0;
    } catch (err) {
      logger.error({ err }, 'Failed to get total chunk count N');
    }

    if (N > 0) {
      // 2. Get n(q_i) and compute IDF for each term
      for (const term of queryTerms) {
        idfMap[term] = await getTermIDF(term, escapedDocIds, escapedUserId, N, client);
      }
      // Cache for 1 hour
      await client.setex(cacheKey, 3600, JSON.stringify(idfMap));
    } else {
      // Fallback
      queryTerms.forEach(t => idfMap[t] = 1);
    }
  }

  // Calculate avgdl based on the retrieved chunks to avoid a costly full-corpus scan
  const avgdl = chunks.reduce((acc, c) => acc + tokenize(c.text).length, 0) / chunks.length || DEFAULT_AVGDL;

  // Score each chunk
  return chunks.map(chunk => {
    const chunkTokens = tokenize(chunk.text);
    const chunkLen = chunkTokens.length;
    
    // Compute Term Frequencies (TF) for this chunk
    const tfMap: Record<string, number> = {};
    for (const token of chunkTokens) {
      tfMap[token] = (tfMap[token] || 0) + 1;
    }

    let bm25Score = 0;
    for (const term of queryTerms) {
      const tf = tfMap[term] || 0;
      if (tf > 0) {
        const idf = idfMap[term] || 0;
        const numerator = tf * (K1 + 1);
        const denominator = tf + K1 * (1 - B + B * (chunkLen / avgdl));
        bm25Score += idf * (numerator / denominator);
      }
    }

    return {
      ...chunk,
      bm25Score
    };
  });
}
