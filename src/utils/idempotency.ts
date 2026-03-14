import type { IdempotencyStore } from '../types/index.js';

export class MemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, boolean>();
  private ttl = new Map<string, number>();
  private readonly defaultTtlSeconds = 86400;

  async has(id: string): Promise<boolean> {
    const expiry = this.ttl.get(id);
    if (expiry && Date.now() > expiry) {
      this.store.delete(id);
      this.ttl.delete(id);
      return false;
    }
    return this.store.has(id);
  }

  async set(id: string, ttlSeconds = this.defaultTtlSeconds): Promise<void> {
    this.store.set(id, true);
    this.ttl.set(id, Date.now() + ttlSeconds * 1000);
  }
}

export function createMemoryIdempotencyStore(): MemoryIdempotencyStore {
  return new MemoryIdempotencyStore();
}
