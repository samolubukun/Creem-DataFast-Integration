import type {
  CreemWebhookRaw,
  CreemCheckoutCompletedEvent,
  CreemSubscriptionPaidEvent,
  CreemRefundCreatedEvent,
  CreemWebhookProduct,
  CreemWebhookCustomer,
} from '../types/creem.js';
import type { DataFastPaymentRequest } from '../types/datafast.js';

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'ISK']);
const THREE_DECIMAL_CURRENCIES = new Set(['KWD', 'BHD', 'OMR', 'TND', 'JOD', 'IQD']);

export interface MappedPaymentData {
  transactionId: string;
  currency: string;
  amount: number;
  visitorId: string | null;
  sessionId?: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  isRenewal: boolean;
  isRefunded: boolean;
  timestamp: string;
}

export function mapCreemEventToDataFast(
  raw: CreemWebhookRaw
): MappedPaymentData | null {
  switch (raw.eventType) {
    case 'checkout.completed':
      return mapCheckoutCompleted(raw as unknown as CreemCheckoutCompletedEvent);
    case 'subscription.paid':
      return mapSubscriptionPaid(raw as unknown as CreemSubscriptionPaidEvent);
    case 'refund.created':
      return mapRefundCreated(raw as unknown as CreemRefundCreatedEvent);
    default:
      return null;
  }
}

function mapCheckoutCompleted(
  event: CreemCheckoutCompletedEvent
): MappedPaymentData | null {
  const obj = event.object;
  if (!obj) return null;

  const order = obj.order;
  const product = obj.product;
  const customer = obj.customer;
  const metadata = obj.metadata;

  const amountCents = order?.amount ?? product?.price ?? 0;
  const currency = order?.currency ?? product?.currency ?? 'USD';

  const transactionId = order?.id ?? obj.id;

  return {
    transactionId,
    currency,
    amount: centsToDecimal(amountCents, currency),
    visitorId: extractVisitorId(metadata),
    sessionId: extractSessionId(metadata),
    customerId: customer?.id,
    customerEmail: customer?.email,
    customerName: customer?.name,
    isRenewal: false,
    isRefunded: false,
    timestamp: order?.created_at ?? new Date(event.created_at).toISOString(),
  };
}

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

  const transactionId = obj.last_transaction_id ?? obj.id;

  return {
    transactionId,
    currency,
    amount: centsToDecimal(amountCents, currency),
    visitorId: extractVisitorId(metadata),
    sessionId: extractSessionId(metadata),
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

function mapRefundCreated(
  event: CreemRefundCreatedEvent
): MappedPaymentData | null {
  const obj = event.object;
  if (!obj) return null;

  const order = obj.order;
  const product = obj.product;
  const customer = obj.customer;
  const metadata = obj.metadata;

  const amountCents = obj.amount ?? order?.amount ?? product?.price ?? 0;
  const currency = order?.currency ?? product?.currency ?? 'USD';

  return {
    transactionId: obj.id,
    currency,
    amount: centsToDecimal(amountCents, currency),
    visitorId: extractVisitorId(metadata),
    sessionId: extractSessionId(metadata),
    customerId: customer?.id,
    customerEmail: customer?.email,
    customerName: customer?.name,
    isRenewal: false,
    isRefunded: true,
    timestamp: obj.created_at ?? new Date(event.created_at).toISOString(),
  };
}

function extractVisitorId(metadata?: Record<string, unknown>): string | null {
  if (!metadata) return null;
  const id = metadata.datafast_visitor_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function extractSessionId(metadata?: Record<string, unknown>): string | undefined {
  if (!metadata) return undefined;
  const id = metadata.datafast_session_id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function centsToDecimal(cents: number, currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())) {
    return cents;
  }
  if (THREE_DECIMAL_CURRENCIES.has(currency.toUpperCase())) {
    return Math.round(cents) / 1000;
  }
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
    datafast_session_id: mapped.sessionId,
  };
}
