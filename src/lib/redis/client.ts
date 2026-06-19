import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'redis-client' });

 
declare global {
  // eslint-disable-next-line no-var
  var redisClient: Redis | undefined;
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6389';

export class RedisConnectionError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'RedisConnectionError';
  }
}

function createRedisClient(): Redis {
  const client = new Redis(REDIS_URL, {
    lazyConnect: true, 
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      if (times > 5) {
        logger.error('Redis reconnect strategy exhausted after 5 attempts.');
        return null; 
      }
      const delay = Math.min(times * 50, 1000);
      logger.info({ retries: times, delay }, 'Reconnecting to Redis...');
      return delay;
    },
  });

  client.on('connect', () => logger.info('Redis client connected'));
  client.on('ready', () => logger.info('Redis client ready'));
  client.on('reconnecting', () => logger.info('Redis client reconnecting'));
  client.on('error', (err) => logger.error({ err }, 'Redis client error'));
  client.on('end', () => logger.info('Redis client disconnected'));

  return client;
}

// Ensure singleton pattern
const client: Redis = globalThis.redisClient || createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.redisClient = client;
}

 
export async function getRedisClient(): Promise<Redis> {
  if (client.status === 'wait') {
    try {
      await client.connect();
    } catch (err) {
      throw new RedisConnectionError('Failed to connect to Redis', err);
    }
  }
  return client;
}

 
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const c = await getRedisClient();
    const result = await c.ping();
    return result === 'PONG';
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    return false;
  }
}
