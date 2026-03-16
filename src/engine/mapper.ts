import { minorToMajor } from '../infrastructure/finance.js';
import { CreemDataFastError } from '../foundation/errors.js';
import type {
  CheckoutCompletedCustomer,
  CheckoutCompletedEvent,
  CheckoutMetadata,
  DataFastPaymentPayload,
  NormalizedTransaction,
  RefundCreatedCustomer,
  RefundCreatedEvent,
  SubscriptionPaidCustomer,
  SubscriptionPaidEvent,
} from '../foundation/types.js';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function readMetadataValue(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toIsoTimestamp(value: number | string | undefined): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }

  const ms = value > 1e12 ? value : value * 1000;
  return new Date(ms).toISOString();
}

function toCustomer(
  value:
    | CheckoutCompletedCustomer
    | SubscriptionPaidCustomer
    | RefundCreatedCustomer
    | string
    | undefined
): CheckoutCompletedCustomer | SubscriptionPaidCustomer | RefundCreatedCustomer | undefined {
  return typeof value === 'object' && value !== null ? value : undefined;
}

function resolveCustomerId(
  value:
    | CheckoutCompletedCustomer
    | SubscriptionPaidCustomer
    | RefundCreatedCustomer
    | string
    | undefined
): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return toCustomer(value)?.id;
}

function withOptionalFields(
  base: DataFastPaymentPayload,
  fields: Partial<DataFastPaymentPayload>
): DataFastPaymentPayload {
  const result: DataFastPaymentPayload = { ...base };

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      result[key as keyof DataFastPaymentPayload] = value as never;
    }
  }

  return result;
}

function getCheckoutMetadata(event: CheckoutCompletedEvent): CheckoutMetadata | undefined {
  return (
    (asRecord(event.object?.metadata) as CheckoutMetadata | undefined) ??
    (asRecord(event.object?.order?.metadata) as CheckoutMetadata | undefined)
  );
}

function getSubscriptionMetadata(event: SubscriptionPaidEvent): CheckoutMetadata | undefined {
  return asRecord(event.object?.metadata) as CheckoutMetadata | undefined;
}

function getRefundVisitorId(event: RefundCreatedEvent): string | undefined {
  return (
    readMetadataValue(asRecord(event.object?.metadata), 'datafast_visitor_id') ??
    readMetadataValue(asRecord(event.object?.transaction?.metadata), 'datafast_visitor_id')
  );
}

function getRefundAmount(event: RefundCreatedEvent): number | undefined {
  return event.object?.refund_amount ?? event.object?.refundAmount;
}

function getRefundCurrency(event: RefundCreatedEvent): string | undefined {
  return event.object?.refund_currency ?? event.object?.refundCurrency;
}

function getRefundTimestamp(event: RefundCreatedEvent): string | undefined {
  return toIsoTimestamp(
    event.object?.created_at ??
      event.object?.createdAt ??
      event.created_at ??
      event.createdAt ??
      event.object?.transaction?.created_at ??
      event.object?.transaction?.createdAt
  );
}

function isRefundRenewal(event: RefundCreatedEvent): boolean {
  const transaction = event.object?.transaction;
  return (
    Boolean(typeof transaction?.subscription === 'string' && transaction.subscription.length > 0) ||
    transaction?.type === 'invoice'
  );
}

export function mapCheckoutCompletedToPayment(
  event: CheckoutCompletedEvent
): DataFastPaymentPayload {
  const order = event.object?.order;
  if (!order) {
    throw new CreemDataFastError('checkout.completed payload is missing order.');
  }

  const customerValue = event.object?.customer;
  const customer = toCustomer(customerValue);
  const metadata = getCheckoutMetadata(event);

  return withOptionalFields(
    {
      amount: minorToMajor(order.amount, order.currency),
      currency: order.currency,
      transaction_id: order.id,
      renewal: false,
    },
    {
      customer_id: resolveCustomerId(customerValue),
      datafast_visitor_id: readMetadataValue(metadata, 'datafast_visitor_id'),
      email: customer?.email,
      name: customer?.name,
    }
  );
}

export function mapSubscriptionPaidToPayment(
  event: SubscriptionPaidEvent,
  transaction?: NormalizedTransaction
): DataFastPaymentPayload {
  const customerValue = event.object?.customer;
  const customer = toCustomer(customerValue);
  const metadata = getSubscriptionMetadata(event);
  const product = event.object?.product;
  const transactionId =
    transaction?.id ?? event.object?.last_transaction_id ?? event.object?.lastTransactionId;

  if (!transactionId) {
    throw new CreemDataFastError('subscription.paid payload is missing last_transaction_id.');
  }

  if (!transaction) {
    if (!product || typeof product.price !== 'number' || typeof product.currency !== 'string') {
      throw new CreemDataFastError(
        'subscription.paid payload is missing product pricing for fallback mapping.'
      );
    }
  }

  return withOptionalFields(
    {
      amount: transaction
        ? minorToMajor(transaction.amount, transaction.currency)
        : minorToMajor(product!.price!, product!.currency!),
      currency: transaction?.currency ?? product!.currency!,
      transaction_id: transactionId,
      renewal: true,
    },
    {
      customer_id: resolveCustomerId(customerValue),
      datafast_visitor_id: readMetadataValue(metadata, 'datafast_visitor_id'),
      email: customer?.email,
      name: customer?.name,
      timestamp:
        transaction?.timestamp ??
        event.object?.last_transaction_date ??
        event.object?.lastTransactionDate,
    }
  );
}

export function mapRefundCreatedToPayment(event: RefundCreatedEvent): DataFastPaymentPayload {
  const refundId = event.object?.id;
  const refundAmount = getRefundAmount(event);
  const refundCurrency = getRefundCurrency(event);
  const customerValue = event.object?.customer ?? event.object?.transaction?.customer;
  const customer = toCustomer(customerValue);

  if (typeof refundId !== 'string' || refundId.length === 0) {
    throw new CreemDataFastError('refund.created payload is missing refund id.');
  }

  if (typeof refundAmount !== 'number' || typeof refundCurrency !== 'string') {
    throw new CreemDataFastError('refund.created payload is missing refund amount or currency.');
  }

  return withOptionalFields(
    {
      amount: minorToMajor(refundAmount, refundCurrency),
      currency: refundCurrency,
      refunded: true,
      renewal: isRefundRenewal(event),
      transaction_id: refundId,
    },
    {
      customer_id: resolveCustomerId(customerValue),
      datafast_visitor_id: getRefundVisitorId(event),
      email: customer?.email,
      name: customer?.name,
      timestamp: getRefundTimestamp(event),
    }
  );
}
