import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreemDataFastClient, createCreemDataFastClient } from '../../src/client/create-checkout.js';

vi.mock('creem', () => ({
  Creem: vi.fn().mockImplementation(() => ({
    checkouts: {
      create: vi.fn().mockResolvedValue({
        id: 'checkout_123',
        checkoutUrl: 'https://checkout.creem.io/checkout_123',
      }),
    },
  })),
}));

describe('CreemDataFastClient', () => {
  let client: CreemDataFastClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates client with apiKey', () => {
      client = new CreemDataFastClient({ apiKey: 'test_key' });
      expect(client).toBeDefined();
    });

    it('uses default cookie name', () => {
      client = new CreemDataFastClient({ apiKey: 'test_key' });
      expect((client as any).cookieName).toBe('datafast_visitor_id');
    });

    it('accepts custom cookie name', () => {
      client = new CreemDataFastClient({ apiKey: 'test_key', cookieName: 'custom_id' });
      expect((client as any).cookieName).toBe('custom_id');
    });
  });

  describe('createCheckout', () => {
    it('creates checkout without visitor ID when no cookies provided', async () => {
      client = new CreemDataFastClient({ apiKey: 'test_key' });

      const result = await client.createCheckout({ productId: 'prod_123' });

      expect(result).toEqual({
        checkoutId: 'checkout_123',
        checkoutUrl: 'https://checkout.creem.io/checkout_123',
      });
    });

    it('creates checkout with visitor ID from cookies string', async () => {
      client = new CreemDataFastClient({ apiKey: 'test_key' });

      const result = await client.createCheckout(
        { productId: 'prod_123' },
        'datafast_visitor_id=df_abc123'
      );

      expect(result).toBeDefined();
    });

    it('creates checkout with visitor ID from cookies object', async () => {
      client = new CreemDataFastClient({ apiKey: 'test_key' });

      const result = await client.createCheckout(
        { productId: 'prod_123' },
        { datafast_visitor_id: 'df_obj123' }
      );

      expect(result).toBeDefined();
    });

    it('passes through metadata to CREEM', async () => {
      client = new CreemDataFastClient({ apiKey: 'test_key' });

      await client.createCheckout({
        productId: 'prod_123',
        metadata: { custom_field: 'value' },
      });

      const creemClient = (client as any).getCreemClient();
      expect(creemClient.checkouts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod_123',
          metadata: { custom_field: 'value' },
        })
      );
    });
  });

  describe('createCheckoutWithVisitorId', () => {
    it('injects visitor ID into metadata', async () => {
      client = new CreemDataFastClient({ apiKey: 'test_key' });

      await client.createCheckoutWithVisitorId(
        { productId: 'prod_123' },
        'df_explicit_visitor'
      );

      const creemClient = (client as any).getCreemClient();
      expect(creemClient.checkouts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod_123',
          metadata: { datafast_visitor_id: 'df_explicit_visitor' },
        })
      );
    });

    it('merges with existing metadata', async () => {
      client = new CreemDataFastClient({ apiKey: 'test_key' });

      await client.createCheckoutWithVisitorId(
        { productId: 'prod_123', metadata: { existing: 'field' } },
        'df_visitor'
      );

      const creemClient = (client as any).getCreemClient();
      expect(creemClient.checkouts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { existing: 'field', datafast_visitor_id: 'df_visitor' },
        })
      );
    });

    it('handles null visitor ID (no injection)', async () => {
      client = new CreemDataFastClient({ apiKey: 'test_key' });

      await client.createCheckoutWithVisitorId(
        { productId: 'prod_123' },
        null
      );

      const creemClient = (client as any).getCreemClient();
      expect(creemClient.checkouts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod_123',
        })
      );
      const call = creemClient.checkouts.create.mock.calls[0][0];
      expect(call.metadata).toEqual({});
    });
  });

  describe('createCreemDataFastClient factory', () => {
    it('creates client instance', () => {
      const client = createCreemDataFastClient({ apiKey: 'test_key' });
      expect(client).toBeInstanceOf(CreemDataFastClient);
    });
  });

  describe('creemClient injection', () => {
    it('uses injected creemClient instead of creating one from apiKey', async () => {
      const mockCheckoutsCreate = vi.fn().mockResolvedValue({
        id: 'injected_checkout',
        checkoutUrl: 'https://checkout.creem.io/injected',
      });

      const injectedClient = {
        checkouts: { create: mockCheckoutsCreate },
      } as any;

      const client = new CreemDataFastClient({ apiKey: '', creemClient: injectedClient });

      const result = await client.createCheckout({ productId: 'prod_injected' });

      expect(result.checkoutId).toBe('injected_checkout');
      expect(mockCheckoutsCreate).toHaveBeenCalledTimes(1);
    });
  });
});
