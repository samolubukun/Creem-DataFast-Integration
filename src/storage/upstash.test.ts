import { describe, it, expect, vi } from 'vitest';
import { createUpstashIdempotencyStore } from './upstash.js';

describe('upstash storage', () => {
  it('claims a key using redis.set nx', async () => {
    const mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
    };
    const store = createUpstashIdempotencyStore(mockRedis as any);
    
    const success = await store.claim('test-key', 123);
    
    expect(success).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'processing', {
      ex: 123,
      nx: true,
    });
  });

  it('fails to claim if redis returns null', async () => {
    const mockRedis = {
      set: vi.fn().mockResolvedValue(null),
    };
    const store = createUpstashIdempotencyStore(mockRedis as any);
    const success = await store.claim('test-key');
    expect(success).toBe(false);
  });

  it('completes a key', async () => {
    const mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
    };
    const store = createUpstashIdempotencyStore(mockRedis as any);
    await store.complete('test-key', 456);
    expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'processed', {
      ex: 456,
    });
  });

  it('releases a key', async () => {
    const mockRedis = {
      del: vi.fn().mockResolvedValue(1),
    };
    const store = createUpstashIdempotencyStore(mockRedis as any);
    await store.release('test-key');
    expect(mockRedis.del).toHaveBeenCalledWith('test-key');
  });
});
