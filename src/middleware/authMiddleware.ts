import { verifyAccessToken } from '../lib/jwt';
import { getRedisClient } from '../lib/redis/client';

export async function authMiddleware(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || req.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'NO_TOKEN' });
    }

    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    }

    // Check Redis blacklist
    if (!req.originalUrl || (!req.originalUrl.includes('/logout') && !req.originalUrl.includes('/logout-all'))) {
      const redisClient = await getRedisClient();
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({ error: 'TOKEN_REVOKED' });
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'AUTH_SERVICE_ERROR' });
  }
}
