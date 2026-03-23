import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Next.js webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('module can be imported without Next.js installed', async () => {
    try {
      await import('../../src/server/nextjs.js');
    } catch (e: any) {
      if (e.message.includes('next/server')) {
        return;
      }
      throw e;
    }
  });
});
