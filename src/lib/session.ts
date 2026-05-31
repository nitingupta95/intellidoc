import { getRedisClient } from './redis/client';

export class SessionStoreError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'SessionStoreError';
  }
}

export async function saveRefreshToken(userId: string, tokenId: string, tokenHash: string): Promise<void> {
  try {
    const client = await getRedisClient();
    const key = `refresh:${userId}:${tokenId}`;
    const pipeline = client.pipeline();
    pipeline.set(key, tokenHash);
    pipeline.expire(key, 604800);
    await pipeline.exec();
  } catch (err) {
    throw new SessionStoreError('Failed to save refresh token to session store', err);
  }
}

export async function getRefreshToken(userId: string, tokenId: string): Promise<string | null> {
  const client = await getRedisClient();
  const key = `refresh:${userId}:${tokenId}`;
  return client.get(key);
}

export async function revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
  const client = await getRedisClient();
  const key = `refresh:${userId}:${tokenId}`;
  await client.del(key);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const client = await getRedisClient();
  const pattern = `refresh:${userId}:*`;
  const keys = await client.keys(pattern);
  
  if (keys && keys.length > 0) {
    await client.del(...keys);
  }
}
