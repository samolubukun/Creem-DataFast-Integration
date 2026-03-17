import { describe, it, expect } from 'vitest';
import {
  mapCheckoutCompletedToPayment,
  mapSubscriptionPaidToPayment,
  mapRefundCreatedToPayment,
} from './mapper.js';
import type { CheckoutCompletedEvent, SubscriptionPaidEvent, RefundCreatedEvent } from '../foundation/types.js';

describe('mapper', () => {
  describe('mapCheckoutCompletedToPayment', () => {
    it('maps basic checkout event', () => {
      const event: CheckoutCompletedEvent = {
        id: 'evt_123',
        eventType: 'checkout.completed',
        object: {
          id: 'pay_123',
          customer: {
            id: 'cus_123',
            email: 'test@example.com',
            name: 'Test User',
          },
          order: {
            id: 'ord_123',
            amount: 1000,
            currency: 'USD',
            type: 'standard',
          },
          metadata: {
            datafast_visitor_id: 'visitor_456',
          },
        },
      } as any;

      const result = mapCheckoutCompletedToPayment(event);

      expect(result).toEqual({
        amount: 10,
        currency: 'USD',
        transaction_id: 'ord_123',
        renewal: false,
        customer_id: 'cus_123',
        datafast_visitor_id: 'visitor_456',
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('throws if order is missing', () => {
      const event: any = { object: {} };
      expect(() => mapCheckoutCompletedToPayment(event)).toThrow('checkout.completed payload is missing order.');
    });
  });

  describe('mapSubscriptionPaidToPayment', () => {
    it('maps subscription payment with transaction override', () => {
      const event: SubscriptionPaidEvent = {
        id: 'evt_sub_123',
        eventType: 'subscription.paid',
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          last_transaction_id: 'txn_123',
          product: {
            id: 'prod_123',
          }
        },
      } as any;

      const transaction = {
        id: 'txn_override',
        amount: 2000,
        currency: 'EUR',
        timestamp: '2026-03-17T00:00:00Z',
      };

      const result = mapSubscriptionPaidToPayment(event, transaction);

      expect(result).toEqual({
        amount: 20,
        currency: 'EUR',
        transaction_id: 'txn_override',
        renewal: true,
        customer_id: 'cus_123',
        timestamp: '2026-03-17T00:00:00Z',
      });
    });

    it('throws if transaction id missing', () => {
      const event: any = { object: {} };
      expect(() => mapSubscriptionPaidToPayment(event)).toThrow('subscription.paid payload is missing last_transaction_id.');
    });
  });

  describe('mapRefundCreatedToPayment', () => {
    it('maps refund event', () => {
      const event: RefundCreatedEvent = {
        id: 'evt_ref_123',
        eventType: 'refund.created',
        object: {
          id: 'ref_123',
          refund_amount: 500,
          refund_currency: 'GBP',
          transaction: {
            id: 'txn_original',
            metadata: {
              datafast_visitor_id: 'visitor_789',
            },
          },
          created_at: '2026-03-17T00:00:00Z',
        },
      } as any;

      const result = mapRefundCreatedToPayment(event);

      expect(result).toEqual({
        amount: 5,
        currency: 'GBP',
        refunded: true,
        renewal: false,
        transaction_id: 'ref_123',
        datafast_visitor_id: 'visitor_789',
        timestamp: '2026-03-17T00:00:00Z',
      });
    });
  });
});
