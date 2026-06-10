import { getRedisClient } from '../lib/redis/client';

export async function loginRateLimiter(req: any, res: any, next: any) {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const key = `login_attempts:${ip}`;
    
    const client = await getRedisClient();
    const attemptsStr = await client.get(key);
    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

    if (attempts >= 5) {
      res.set('Retry-After', '900');
      return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS', retryAfter: 900 });
    }

    const pipeline = client.pipeline();
    pipeline.set(key, attempts + 1);
    if (attempts === 0) {
      pipeline.expire(key, 900);
    }
    await pipeline.exec();

    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    // Fail open
    next();
  }
}

export async function clearLoginAttempts(ip: string) {
  try {
    const client = await getRedisClient();
    await client.del(`login_attempts:${ip}`);
  } catch (error) {
    console.error('Failed to clear login attempts:', error);
  }
}
