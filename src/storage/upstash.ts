import type { Redis } from '@upstash/redis';
import type { IdempotencyStore } from '../foundation/types.js';

type UpstashRedisLike = Pick<Redis, 'del' | 'set'>;

export function createUpstashIdempotencyStore(redis: UpstashRedisLike): IdempotencyStore {
  return {
    async claim(key, ttlSeconds = 300) {
      const result = await redis.set(key, 'processing', {
        ex: ttlSeconds,
        nx: true,
      });
      return result === 'OK';
    },
    async complete(key, ttlSeconds = 86400) {
      await redis.set(key, 'processed', {
        ex: ttlSeconds,
      });
    },
    async release(key) {
      await redis.del(key);
    },
  };
}
