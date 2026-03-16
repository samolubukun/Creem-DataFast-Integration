import { z } from 'zod';

export const CreemOrderSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  type: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const CreemCustomerSchema = z.object({
  id: z.string().optional(),
  email: z.string().optional(),
  name: z.string().optional(),
});

export const CreemSubscriptionSchema = z.object({
  id: z.string().optional(),
});

export const CheckoutCompletedSchema = z.object({
  id: z.string(),
  eventType: z.string().optional(),
  event_type: z.string().optional(),
  object: z.object({
    order: CreemOrderSchema.optional(),
    customer: z.union([CreemCustomerSchema, z.string()]).optional(),
    metadata: z.record(z.any()).optional(),
    subscription: z.union([CreemSubscriptionSchema, z.string()]).optional(),
  }),
});

export const SubscriptionPaidSchema = z.object({
  id: z.string(),
  eventType: z.string().optional(),
  event_type: z.string().optional(),
  object: z.object({
    customer: z.union([CreemCustomerSchema, z.string()]).optional(),
    metadata: z.record(z.any()).optional(),
    product: z
      .object({
        price: z.number().optional(),
        currency: z.string().optional(),
      })
      .optional(),
    last_transaction_id: z.string().optional(),
    lastTransactionId: z.string().optional(),
    last_transaction_date: z.string().optional(),
    lastTransactionDate: z.string().optional(),
  }),
});

export const RefundCreatedSchema = z.object({
  id: z.string(),
  eventType: z.string().optional(),
  event_type: z.string().optional(),
  created_at: z.union([z.number(), z.string()]).optional(),
  createdAt: z.union([z.number(), z.string()]).optional(),
  object: z.object({
    id: z.string().optional(),
    refund_amount: z.number().optional(),
    refundAmount: z.number().optional(),
    refund_currency: z.string().optional(),
    refundCurrency: z.string().optional(),
    customer: z.union([CreemCustomerSchema, z.string()]).optional(),
    metadata: z.record(z.any()).optional(),
    created_at: z.union([z.number(), z.string()]).optional(),
    createdAt: z.union([z.number(), z.string()]).optional(),
    transaction: z
      .object({
        id: z.string().optional(),
        subscription: z.string().nullish(),
        type: z.string().optional(),
        metadata: z.record(z.any()).optional(),
        created_at: z.union([z.number(), z.string()]).optional(),
        createdAt: z.union([z.number(), z.string()]).optional(),
      })
      .optional(),
  }),
});
