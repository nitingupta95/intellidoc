import OpenAI from 'openai';
import crypto from 'crypto';
import pino from 'pino';
import { getRedisClient } from '../../redis/client';

const logger = pino({ name: 'embedding-service' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class EmbeddingRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingRateLimitError';
  }
}

/**
 * Generates embeddings for chunks of text in batches of 100.
 * Utilizes exponential backoff for 429 Rate Limit errors (max 3 retries).
 * Caches embeddings in Redis for 3600 seconds to save API costs on identical chunks.
 */
export async function embedChunks(
  texts: string[],
  docId: string
): Promise<number[][]> {
  const BATCH_SIZE = 100;
  const CACHE_TTL = 3600; // 1 hour
  const redis = await getRedisClient();
  
  const embeddings: number[][] = new Array(texts.length);
  const cacheKeys: string[] = new Array(texts.length);
  const toEmbed: { index: number; text: string }[] = [];

  logger.info({ docId, totalChunks: texts.length }, 'Starting embedding process');

  // Check cache first
  const pipeline = redis.pipeline();
  for (let i = 0; i < texts.length; i++) {
    const hash = crypto.createHash('sha256').update(texts[i]).digest('hex');
    cacheKeys[i] = `cache:embed:${hash}`;
    pipeline.get(cacheKeys[i]);
  }

  const cacheResults = await pipeline.exec();
  
  let cacheHits = 0;
  for (let i = 0; i < texts.length; i++) {
    const cached = cacheResults?.[i]?.[1] as string | null;
    if (cached) {
      embeddings[i] = JSON.parse(cached);
      cacheHits++;
    } else {
      toEmbed.push({ index: i, text: texts[i] });
    }
  }

  logger.info({ docId, cacheHits, missCount: toEmbed.length }, 'Cache check complete');

  // Process misses in batches of 100
  let apiCalls = 0;
  let totalTokensUsed = 0;

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const batchTexts = batch.map(b => b.text);
    
    let success = false;
    let retries = 0;
    const maxRetries = 3;

    while (!success && retries <= maxRetries) {
      try {
        apiCalls++;
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small', // Default cost-efficient model
          input: batchTexts,
        });

        totalTokensUsed += response.usage.total_tokens;

        // Save back to array and cache
        const savePipeline = redis.pipeline();
        
        for (let j = 0; j < response.data.length; j++) {
          const originalIndex = batch[j].index;
          const vector = response.data[j].embedding;
          
          embeddings[originalIndex] = vector;
          savePipeline.setex(cacheKeys[originalIndex], CACHE_TTL, JSON.stringify(vector));
        }
        
        await savePipeline.exec();
        success = true;

      } catch (error: any) {
        if (error.status === 429) {
          retries++;
          if (retries > maxRetries) {
            throw new EmbeddingRateLimitError(`Rate limit exceeded after ${maxRetries} retries`);
          }
          const waitTime = Math.pow(2, retries) * 10000; // 20s, 40s, 80s
          logger.warn({ docId, retries, waitTime }, 'Rate limit 429 hit. Backing off.');
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          logger.error({ error, docId }, 'OpenAI embedding API failed');
          throw error;
        }
      }
    }
  }

  logger.info(
    { 
      docId, 
      totalChunks: texts.length, 
      cacheHits, 
      apiCalls, 
      totalTokensUsed 
    }, 
    'Embedding process completed'
  );

  return embeddings;
}
