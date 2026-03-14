import type {
  CreemWebhookRaw,
  CreemCheckoutCompletedEvent,
  CreemSubscriptionPaidEvent,
  CreemWebhookProduct,
  CreemWebhookCustomer,
} from '../types/creem.js';
import type { DataFastPaymentRequest } from '../types/datafast.js';

// ---------------------------------------------------------------------------
// Intermediate mapped type
// ---------------------------------------------------------------------------

export interface MappedPaymentData {
  transactionId: string;
  currency: string;
  /** Decimal amount (e.g. 29.99), NOT cents. */
  amount: number;
  visitorId: string | null;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  isRenewal: boolean;
  isRefunded: boolean;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Accepts a raw CREEM webhook body (already parsed from JSON) and returns
 * a `MappedPaymentData` if the event is one we handle, or `null` otherwise.
 */
export function mapCreemEventToDataFast(
  raw: CreemWebhookRaw
): MappedPaymentData | null {
  switch (raw.eventType) {
    case 'checkout.completed':
      return mapCheckoutCompleted(raw as unknown as CreemCheckoutCompletedEvent);
    case 'subscription.paid':
      return mapSubscriptionPaid(raw as unknown as CreemSubscriptionPaidEvent);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// checkout.completed
// ---------------------------------------------------------------------------

function mapCheckoutCompleted(
  event: CreemCheckoutCompletedEvent
): MappedPaymentData | null {
  const obj = event.object;
  if (!obj) return null;

  const order = obj.order;
  const product = obj.product;
  const customer = obj.customer;
  const metadata = obj.metadata;

  // Use the order amount/currency (these are the actual charged values).
  // Fall back to the product price if order is missing.
  const amountCents = order?.amount ?? product?.price ?? 0;
  const currency = order?.currency ?? product?.currency ?? 'USD';

  // Transaction ID: prefer order ID, fall back to checkout ID.
  const transactionId = order?.id ?? obj.id;

  return {
    transactionId,
    currency,
    amount: centsToDecimal(amountCents),
    visitorId: extractVisitorId(metadata),
    customerId: customer?.id,
    customerEmail: customer?.email,
    customerName: customer?.name,
    isRenewal: false,
    isRefunded: false,
    timestamp: order?.created_at ?? new Date(event.created_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// subscription.paid
// ---------------------------------------------------------------------------

function mapSubscriptionPaid(
  event: CreemSubscriptionPaidEvent
): MappedPaymentData | null {
  const obj = event.object;
  if (!obj) return null;

  const product = resolveProduct(obj.product);
  const customer = resolveCustomer(obj.customer);
  const metadata = obj.metadata;

  const amountCents = product?.price ?? 0;
  const currency = product?.currency ?? 'USD';

  // Prefer the last_transaction_id (the actual transaction for this billing
  // cycle) over the subscription ID.
  const transactionId = obj.last_transaction_id ?? obj.id;

  return {
    transactionId,
    currency,
    amount: centsToDecimal(amountCents),
    visitorId: extractVisitorId(metadata),
    customerId: customer?.id,
    customerEmail: customer?.email,
    customerName: customer?.name,
    isRenewal: true,
    isRefunded: false,
    timestamp:
      obj.last_transaction_date ??
      obj.current_period_start_date ??
      new Date(event.created_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractVisitorId(
  metadata?: Record<string, unknown>
): string | null {
  if (!metadata) return null;
  const id = metadata.datafast_visitor_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function centsToDecimal(cents: number): number {
  return Math.round(cents) / 100;
}

function resolveProduct(
  p: string | CreemWebhookProduct | undefined
): CreemWebhookProduct | undefined {
  if (!p || typeof p === 'string') return undefined;
  return p;
}

function resolveCustomer(
  c: string | CreemWebhookCustomer | undefined
): CreemWebhookCustomer | undefined {
  if (!c || typeof c === 'string') return undefined;
  return c;
}

// ---------------------------------------------------------------------------
// DataFast request builder
// ---------------------------------------------------------------------------

export function mapToDataFastPaymentRequest(
  mapped: MappedPaymentData
): DataFastPaymentRequest {
  return {
    transaction_id: mapped.transactionId,
    currency: mapped.currency,
    amount: mapped.amount,
    timestamp: mapped.timestamp,
    refunded: mapped.isRefunded,
    renewal: mapped.isRenewal,
    customer_id: mapped.customerId,
    email: mapped.customerEmail,
    name: mapped.customerName,
    datafast_visitor_id: mapped.visitorId ?? undefined,
  };
}
