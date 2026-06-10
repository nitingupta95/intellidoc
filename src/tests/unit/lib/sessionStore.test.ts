import { describe, it, expect, vi, beforeAll } from 'vitest';
import ioredis from 'ioredis';
import { saveRefreshToken, getRefreshToken, revokeRefreshToken, revokeAllUserTokens, SessionStoreError } from '../../../lib/session';

describe('Redis session store', () => {
  let redisClient: ioredis;

  beforeAll(() => {
    redisClient = new ioredis();
  });

  describe('saveRefreshToken', () => {
    it('pipeline.set called with correct key pattern', async () => {
      await saveRefreshToken('uid1', 'tid1', 'tokenHash');
      const pipeline = redisClient.pipeline();
      expect(pipeline.set).toHaveBeenCalledWith('refresh:uid1:tid1', 'tokenHash');
    });

    it('pipeline.expire sets TTL of 604800', async () => {
      await saveRefreshToken('uid1', 'tid1', 'tokenHash');
      const pipeline = redisClient.pipeline();
      expect(pipeline.expire).toHaveBeenCalledWith('refresh:uid1:tid1', 604800);
    });

    it('pipeline.exec called once', async () => {
      await saveRefreshToken('uid1', 'tid1', 'tokenHash');
      const pipeline = redisClient.pipeline();
      expect(pipeline.exec).toHaveBeenCalled();
    });

    it('if pipeline.exec rejects → throws SessionStoreError', async () => {
      const pipeline = redisClient.pipeline();
      vi.mocked(pipeline.exec).mockRejectedValueOnce(new Error('Redis Error'));
      
      await expect(saveRefreshToken('uid1', 'tid1', 'tokenHash')).rejects.toThrow(SessionStoreError);
    });
  });

  describe('getRefreshToken', () => {
    it('redis.get called with correct key', async () => {
      await getRefreshToken('uid1', 'tid1');
      expect(redisClient.get).toHaveBeenCalledWith('refresh:uid1:tid1');
    });

    it('returns stored hash when key exists', async () => {
      vi.mocked(redisClient.get).mockResolvedValueOnce('tokenHash');
      const val = await getRefreshToken('uid1', 'tid1');
      expect(val).toBe('tokenHash');
    });

    it('returns null when key missing', async () => {
      vi.mocked(redisClient.get).mockResolvedValueOnce(null);
      const val = await getRefreshToken('uid1', 'tid1');
      expect(val).toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('redis.del called with correct key', async () => {
      await revokeRefreshToken('uid1', 'tid1');
      expect(redisClient.del).toHaveBeenCalledWith('refresh:uid1:tid1');
    });

    it('subsequent getRefreshToken returns null', async () => {
      // Mock del to do nothing, then get to return null to simulate deletion
      vi.mocked(redisClient.get).mockResolvedValueOnce(null);
      await revokeRefreshToken('uid1', 'tid1');
      const val = await getRefreshToken('uid1', 'tid1');
      expect(val).toBeNull();
    });
  });

  describe('revokeAllUserTokens', () => {
    it('redis.keys called with pattern refresh:uid1:*', async () => {
      vi.mocked(redisClient.keys).mockResolvedValueOnce(['refresh:uid1:tid1', 'refresh:uid1:tid2']);
      await revokeAllUserTokens('uid1');
      expect(redisClient.keys).toHaveBeenCalledWith('refresh:uid1:*');
    });

    it('redis.del called for each matching key', async () => {
      vi.mocked(redisClient.keys).mockResolvedValueOnce(['refresh:uid1:tid1', 'refresh:uid1:tid2']);
      await revokeAllUserTokens('uid1');
      expect(redisClient.del).toHaveBeenCalledWith('refresh:uid1:tid1', 'refresh:uid1:tid2');
    });

    it('if user has 0 tokens → no del call, no error', async () => {
      vi.mocked(redisClient.keys).mockResolvedValueOnce([]);
      await revokeAllUserTokens('uid1');
      expect(redisClient.del).not.toHaveBeenCalled();
    });
  });
});
