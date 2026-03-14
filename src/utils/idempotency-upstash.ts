import type { IdempotencyStore } from '../types/index.js';

interface Redis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, { ex }: { ex: number }): Promise<void>;
}

export function createUpstashIdempotencyStore(redis: Redis, ttlSeconds = 86400): IdempotencyStore {
  return {
    async has(id: string): Promise<boolean> {
      const result = await redis.get(id);
      return result !== null;
    },

    async set(id: string): Promise<void> {
      await redis.set(id, '1', { ex: ttlSeconds });
    },
  };
}
