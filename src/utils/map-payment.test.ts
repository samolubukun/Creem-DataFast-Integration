import { describe, it, expect } from 'vitest';
import {
  mapCreemEventToDataFast,
  mapToDataFastPaymentRequest,
} from '../../src/utils/map-payment';
import type { CreemWebhookRaw, CreemCheckoutCompletedEvent, CreemSubscriptionPaidEvent } from '../../src/types/creem';

describe('mapCreemEventToDataFast', () => {
  describe('checkout.completed', () => {
    it('maps checkout.completed event correctly', () => {
      const rawEvent: CreemWebhookRaw = {
        id: 'evt_123',
        eventType: 'checkout.completed',
        created_at: 1700000000000,
        object: {
          id: 'checkout_abc',
          object: 'checkout',
          order: {
            id: 'order_xyz',
            customer: 'cust_1',
            product: 'prod_1',
            amount: 2999,
            currency: 'EUR',
            status: 'completed',
            type: 'one_time',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            mode: 'live',
          },
          product: {
            id: 'prod_1',
            name: 'Pro Plan',
            description: 'Pro plan desc',
            image_url: null,
            price: 2999,
            currency: 'EUR',
            billing_type: 'one_time',
            status: 'active',
            tax_mode: 'none',
            tax_category: 'digital',
            default_success_url: 'https://example.com/success',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            mode: 'live',
          },
          customer: {
            id: 'cust_1',
            object: 'customer',
            email: 'test@example.com',
            name: 'Test User',
            country: 'US',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            mode: 'live',
          },
          metadata: {
            datafast_visitor_id: 'df_visitor_123',
          },
          status: 'completed',
          mode: 'live',
        } as any,
      };

      const result = mapCreemEventToDataFast(rawEvent);

      expect(result).not.toBeNull();
      expect(result!.transactionId).toBe('order_xyz');
      expect(result!.currency).toBe('EUR');
      expect(result!.amount).toBe(29.99);
      expect(result!.visitorId).toBe('df_visitor_123');
      expect(result!.customerId).toBe('cust_1');
      expect(result!.customerEmail).toBe('test@example.com');
      expect(result!.customerName).toBe('Test User');
      expect(result!.isRenewal).toBe(false);
      expect(result!.isRefunded).toBe(false);
    });

    it('returns default values when no order or product', () => {
      const rawEvent: CreemWebhookRaw = {
        id: 'evt_123',
        eventType: 'checkout.completed',
        created_at: 1700000000000,
        object: { id: 'checkout_abc' } as any,
      };

      const result = mapCreemEventToDataFast(rawEvent);
      expect(result).not.toBeNull();
      expect(result!.transactionId).toBe('checkout_abc');
      expect(result!.currency).toBe('USD');
      expect(result!.amount).toBe(0);
    });

    it('handles missing visitor id', () => {
      const rawEvent: CreemWebhookRaw = {
        id: 'evt_123',
        eventType: 'checkout.completed',
        created_at: 1700000000000,
        object: {
          id: 'checkout_abc',
          object: 'checkout',
          order: {
            id: 'order_xyz',
            customer: 'cust_1',
            product: 'prod_1',
            amount: 1000,
            currency: 'USD',
            status: 'completed',
            type: 'one_time',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            mode: 'live',
          },
          product: {
            id: 'prod_1',
            name: 'Basic',
            description: 'desc',
            image_url: null,
            price: 1000,
            currency: 'USD',
            billing_type: 'one_time',
            status: 'active',
            tax_mode: 'none',
            tax_category: 'digital',
            default_success_url: 'https://example.com/success',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            mode: 'live',
          },
          customer: {
            id: 'cust_1',
            object: 'customer',
            email: 'test@example.com',
            name: 'Test User',
            country: 'US',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            mode: 'live',
          },
          status: 'completed',
          mode: 'live',
        } as any,
      };

      const result = mapCreemEventToDataFast(rawEvent);

      expect(result).not.toBeNull();
      expect(result!.visitorId).toBeNull();
    });
  });

  describe('subscription.paid', () => {
    it('maps subscription.paid event correctly', () => {
      const rawEvent: CreemWebhookRaw = {
        id: 'evt_sub_123',
        eventType: 'subscription.paid',
        created_at: 1700000000000,
        object: {
          id: 'sub_abc',
          object: 'subscription',
          product: {
            id: 'prod_1',
            name: 'Monthly Plan',
            description: 'Monthly desc',
            image_url: null,
            price: 1999,
            currency: 'GBP',
            billing_type: 'recurring',
            billing_period: 'month',
            status: 'active',
            tax_mode: 'none',
            tax_category: 'digital',
            default_success_url: 'https://example.com/success',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            mode: 'live',
          },
          customer: {
            id: 'cust_1',
            object: 'customer',
            email: 'sub@example.com',
            name: 'Subscriber',
            country: 'UK',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            mode: 'live',
          },
          collection_method: 'chargeAutomatically',
          status: 'active',
          last_transaction_id: 'txn_xyz',
          last_transaction_date: '2024-02-01T00:00:00Z',
          next_transaction_date: '2024-03-01T00:00:00Z',
          current_period_start_date: '2024-02-01T00:00:00Z',
          current_period_end_date: '2024-03-01T00:00:00Z',
          canceled_at: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-02-01T00:00:00Z',
          metadata: {
            datafast_visitor_id: 'df_sub_visitor',
          },
          mode: 'live',
        } as any,
      };

      const result = mapCreemEventToDataFast(rawEvent);

      expect(result).not.toBeNull();
      expect(result!.transactionId).toBe('txn_xyz');
      expect(result!.currency).toBe('GBP');
      expect(result!.amount).toBe(19.99);
      expect(result!.visitorId).toBe('df_sub_visitor');
      expect(result!.customerId).toBe('cust_1');
      expect(result!.customerEmail).toBe('sub@example.com');
      expect(result!.customerName).toBe('Subscriber');
      expect(result!.isRenewal).toBe(true);
      expect(result!.isRefunded).toBe(false);
    });

    it('uses subscription id when last_transaction_id is missing', () => {
      const rawEvent: CreemWebhookRaw = {
        id: 'evt_sub_123',
        eventType: 'subscription.paid',
        created_at: 1700000000000,
        object: {
          id: 'sub_abc',
          object: 'subscription',
          product: {
            id: 'prod_1',
            name: 'Monthly Plan',
            description: 'desc',
            image_url: null,
            price: 999,
            currency: 'USD',
            billing_type: 'recurring',
            status: 'active',
            tax_mode: 'none',
            tax_category: 'digital',
            default_success_url: 'https://example.com/success',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            mode: 'live',
          },
          customer: {
            id: 'cust_1',
            object: 'customer',
            email: 'test@example.com',
            name: 'Test',
            country: 'US',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            mode: 'live',
          },
          collection_method: 'chargeAutomatically',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          mode: 'live',
        } as any,
      };

      const result = mapCreemEventToDataFast(rawEvent);

      expect(result).not.toBeNull();
      expect(result!.transactionId).toBe('sub_abc');
    });

    it('returns default values when no product', () => {
      const rawEvent: CreemWebhookRaw = {
        id: 'evt_sub_123',
        eventType: 'subscription.paid',
        created_at: 1700000000000,
        object: { id: 'sub_abc' } as any,
      };

      const result = mapCreemEventToDataFast(rawEvent);
      expect(result).not.toBeNull();
      expect(result!.transactionId).toBe('sub_abc');
      expect(result!.currency).toBe('USD');
      expect(result!.amount).toBe(0);
    });
  });

  describe('unsupported events', () => {
    it('returns null for unsupported event types', () => {
      const rawEvent: CreemWebhookRaw = {
        id: 'evt_123',
        eventType: 'checkout.created',
        created_at: 1700000000000,
        object: {} as any,
      };

      const result = mapCreemEventToDataFast(rawEvent);
      expect(result).toBeNull();
    });

    it('returns null for unknown event types', () => {
      const rawEvent: CreemWebhookRaw = {
        id: 'evt_123',
        eventType: 'unknown.event',
        created_at: 1700000000000,
        object: {} as any,
      };

      const result = mapCreemEventToDataFast(rawEvent);
      expect(result).toBeNull();
    });
  });
});

describe('mapToDataFastPaymentRequest', () => {
  it('maps mapped data to DataFast request format', () => {
    const mapped = {
      transactionId: 'txn_abc123',
      currency: 'EUR',
      amount: 29.99,
      visitorId: 'df_visitor_xyz',
      customerId: 'cust_1',
      customerEmail: 'test@example.com',
      customerName: 'Test User',
      isRenewal: false,
      isRefunded: false,
      timestamp: '2024-01-15T10:30:00Z',
    };

    const result = mapToDataFastPaymentRequest(mapped);

    expect(result).toEqual({
      transaction_id: 'txn_abc123',
      currency: 'EUR',
      amount: 29.99,
      timestamp: '2024-01-15T10:30:00Z',
      refunded: false,
      renewal: false,
      customer_id: 'cust_1',
      email: 'test@example.com',
      name: 'Test User',
      datafast_visitor_id: 'df_visitor_xyz',
    });
  });

  it('handles null visitorId (excludes from request)', () => {
    const mapped = {
      transactionId: 'txn_abc123',
      currency: 'USD',
      amount: 10.0,
      visitorId: null,
      customerId: undefined,
      customerEmail: undefined,
      customerName: undefined,
      isRenewal: true,
      isRefunded: false,
      timestamp: '2024-01-15T10:30:00Z',
    };

    const result = mapToDataFastPaymentRequest(mapped);

    expect(result.datafast_visitor_id).toBeUndefined();
    expect(result.renewal).toBe(true);
    expect(result.customer_id).toBeUndefined();
  });

  it('sets refunded flag correctly', () => {
    const mapped = {
      transactionId: 'txn_refunded',
      currency: 'GBP',
      amount: 15.0,
      visitorId: 'df_visitor',
      customerId: undefined,
      customerEmail: undefined,
      customerName: undefined,
      isRenewal: false,
      isRefunded: true,
      timestamp: '2024-01-15T10:30:00Z',
    };

    const result = mapToDataFastPaymentRequest(mapped);
    expect(result.refunded).toBe(true);
  });
});
