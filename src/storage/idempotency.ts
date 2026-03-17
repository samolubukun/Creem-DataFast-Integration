import type { IdempotencyStore } from '../foundation/types.js';

export class MemoryIdempotencyStore implements IdempotencyStore {
  private cache = new Map<string, { status: 'processing' | 'processed'; expires: number }>();

  async claim(key: string, ttlSeconds = 300): Promise<boolean> {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (entry && entry.expires > now) {
      return false;
    }

    this.cache.set(key, { status: 'processing', expires: now + ttlSeconds * 1000 });
    return true;
  }

  async complete(key: string, ttlSeconds = 86400): Promise<void> {
    this.cache.set(key, { status: 'processed', expires: Date.now() + ttlSeconds * 1000 });
  }

  async release(key: string): Promise<void> {
    this.cache.delete(key);
  }
}

export function resolveIdempotencyStore(store?: IdempotencyStore): IdempotencyStore {
  return store ?? new MemoryIdempotencyStore();
}

export async function claimEvent(
  eventId: string,
  store: IdempotencyStore,
  ttlSeconds: number
): Promise<boolean> {
  return store.claim(`creem_event_${eventId}`, ttlSeconds);
}

export async function completeEvent(
  eventId: string,
  store: IdempotencyStore,
  ttlSeconds: number
): Promise<void> {
  await store.complete(`creem_event_${eventId}`, ttlSeconds);
}

export async function releaseEvent(eventId: string, store: IdempotencyStore): Promise<void> {
  await store.release(`creem_event_${eventId}`);
}
