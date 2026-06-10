import { getRedisClient } from '../src/lib/redis/client';
import pino from 'pino';

const logger = pino({ name: 'redis-init' });

async function initRedis() {
  const client = await getRedisClient();

  const indexName = 'idx:chunks';

  try {
    logger.info(`Attempting to drop existing index: ${indexName}`);
    try {
      // Drop the index but DO NOT delete the underlying hashes
      await client.call('FT.DROPINDEX', indexName);
      logger.info(`Dropped existing index: ${indexName}`);
    } catch (err: any) {
      if (err.message && err.message.includes('Unknown Index name')) {
        logger.info(`Index ${indexName} does not exist yet.`);
      } else {
        throw err;
      }
    }

    logger.info(`Creating index: ${indexName}`);
    
    // Raw FT.CREATE command for ioredis
    await client.call(
      'FT.CREATE',
      indexName,
      'ON', 'HASH',
      'PREFIX', '1', 'doc:chunk:',
      'SCHEMA',
      'docId', 'TEXT', 'SORTABLE',
      'userId', 'TEXT', 'SORTABLE',
      'text', 'TEXT', 'WEIGHT', '2.0',
      'pageNum', 'NUMERIC', 'SORTABLE',
      'chunkIdx', 'NUMERIC', 'SORTABLE',
      'embedding', 'VECTOR', 'HNSW', '6',
      'TYPE', 'FLOAT32',
      'DIM', '1536',
      'DISTANCE_METRIC', 'COSINE',
      'M', '16',
      'EF_CONSTRUCTION', '200'
    );

    logger.info(`Successfully created index: ${indexName}`);

    // Log the index info
    const info = await client.call('FT.INFO', indexName);
    logger.info({ info }, `Index Info for ${indexName}`);

    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Redis index');
    process.exit(1);
  }
}

initRedis();
