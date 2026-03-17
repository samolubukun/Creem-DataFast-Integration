import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryIdempotencyStore, claimEvent, completeEvent, releaseEvent } from './idempotency.js';

describe('idempotency (memory)', () => {
  let store: MemoryIdempotencyStore;

  beforeEach(() => {
    store = new MemoryIdempotencyStore();
    vi.useFakeTimers();
  });

  it('claims a new key', async () => {
    const success = await store.claim('test-key');
    expect(success).toBe(true);
  });

  it('rejects an existing in-flight key', async () => {
    await store.claim('test-key');
    const success = await store.claim('test-key');
    expect(success).toBe(false);
  });

  it('allows claiming after ttl expires', async () => {
    await store.claim('test-key', 10);
    vi.advanceTimersByTime(11000);
    const success = await store.claim('test-key');
    expect(success).toBe(true);
  });

  it('marks a key as completed', async () => {
    await store.claim('test-key');
    await store.complete('test-key');
    const success = await store.claim('test-key');
    expect(success).toBe(false); // Still blocked because it's 'processed'
  });

  it('releases a key', async () => {
    await store.claim('test-key');
    await store.release('test-key');
    const success = await store.claim('test-key');
    expect(success).toBe(true);
  });

  describe('event helpers', () => {
    it('wraps keys for events', async () => {
      const spy = vi.spyOn(store, 'claim');
      await claimEvent('123', store, 300);
      expect(spy).toHaveBeenCalledWith('creem_event_123', 300);
    });
  });
});
