import {
  InvalidCreemSignatureError,
  UnsupportedWebhookEventError,
  WebhookValidationError,
} from '../foundation/errors.js';
import {
  CheckoutCompletedSchema,
  RefundCreatedSchema,
  SubscriptionPaidSchema,
} from '../foundation/schemas.js';
import { claimEvent, completeEvent, releaseEvent, resolveIdempotencyStore } from '../storage/idempotency.js';
import {
  mapCheckoutCompletedToPayment,
  mapRefundCreatedToPayment,
  mapSubscriptionPaidToPayment,
} from './mapper.js';
import { extractHeader, verifyCreemSignature } from './signature.js';
import { hydrateTransaction } from './hydration.js';
import type {
  CheckoutCompletedEvent,
  DataFastPaymentPayload,
  HandleWebhookParams,
  HandleWebhookResult,
  RefundCreatedEvent,
  SubscriptionPaidEvent,
  SupportedWebhookEvent,
  WebhookHandlerDependencies,
} from '../foundation/types.js';

function getEventType(payload: Record<string, unknown>): string | undefined {
  const eventType = payload.eventType ?? payload.event_type;
  return typeof eventType === 'string' ? eventType : undefined;
}

function getEventId(payload: Record<string, unknown>): string | undefined {
  return typeof payload.id === 'string' ? payload.id : undefined;
}

function isSupportedWebhookEvent(eventType: string): eventType is SupportedWebhookEvent {
  return (
    eventType === 'checkout.completed' ||
    eventType === 'subscription.paid' ||
    eventType === 'refund.created'
  );
}

function parseWebhookPayload(rawBody: string): Record<string, unknown> {
  return JSON.parse(rawBody) as Record<string, unknown>;
}

function isInitialSubscriptionCheckout(payload: CheckoutCompletedEvent): boolean {
  const orderType = payload.object?.order?.type;
  const subscription = payload.object?.subscription;

  return (
    orderType === 'recurring' ||
    typeof subscription === 'string' ||
    (typeof subscription === 'object' && subscription !== null)
  );
}

export async function handleWebhook(
  params: HandleWebhookParams,
  dependencies: WebhookHandlerDependencies,
  options?: { skipIdempotency?: boolean }
): Promise<HandleWebhookResult> {
  const signature = extractHeader(params.headers, 'creem-signature');
  if (!signature) {
    throw new InvalidCreemSignatureError('Missing creem-signature header.');
  }

  if (!(await verifyCreemSignature(params.rawBody, dependencies.creemWebhookSecret, signature))) {
    throw new InvalidCreemSignatureError('Invalid Creem webhook signature.');
  }

  const payload = parseWebhookPayload(params.rawBody);
  const eventType = getEventType(payload);
  const eventId = getEventId(payload);

  if (!eventType) {
    throw new UnsupportedWebhookEventError('Webhook payload is missing eventType.');
  }

  if (!isSupportedWebhookEvent(eventType)) {
    return {
      ok: true,
      ignored: true,
      eventId,
      eventType,
      reason: 'unsupported_event',
    };
  }

  if (dependencies.eventFilter && !dependencies.eventFilter.includes(eventType)) {
    return {
      ok: true,
      ignored: true,
      eventId,
      eventType,
      reason: 'unsupported_event',
    };
  }

  if (!eventId) {
    throw new UnsupportedWebhookEventError('Supported webhook payload is missing id.');
  }

  const idempotencyStore = resolveIdempotencyStore(dependencies.idempotencyStore);
  if (!options?.skipIdempotency) {
    const canProcess = await claimEvent(
      eventId,
      idempotencyStore,
      dependencies.idempotencyInFlightTtlSeconds
    );
    if (!canProcess) {
      return {
        ok: true,
        ignored: true,
        eventId,
        eventType,
        reason: 'duplicate_event',
      };
    }
  }

  if (
    eventType === 'checkout.completed' &&
    isInitialSubscriptionCheckout(payload as any)
  ) {
    await completeEvent(eventId, idempotencyStore, dependencies.idempotencyProcessedTtlSeconds);
    return {
      ok: true,
      ignored: true,
      eventId,
      eventType,
      reason: 'delegated_to_subscription_paid',
    };
  }

  // Validate payload with Zod
  try {
    if (eventType === 'checkout.completed') {
      CheckoutCompletedSchema.parse(payload);
    } else if (eventType === 'subscription.paid') {
      SubscriptionPaidSchema.parse(payload);
    } else if (eventType === 'refund.created') {
      RefundCreatedSchema.parse(payload);
    }
  } catch (error) {
    await releaseEvent(eventId, idempotencyStore);
    if (error instanceof Error) {
      throw new WebhookValidationError(`Invalid ${eventType} payload: ${error.message}`, error);
    }
    throw error;
  }

  let normalizedPayload: DataFastPaymentPayload | undefined;
  let datafastResponse: unknown;

  try {
    normalizedPayload =
      eventType === 'checkout.completed'
        ? mapCheckoutCompletedToPayment(payload as any)
        : eventType === 'refund.created'
          ? mapRefundCreatedToPayment(payload as any)
          : await (async () => {
              const subscriptionPayload = payload as any;
              const lastTransactionId =
                subscriptionPayload.object?.last_transaction_id ??
                subscriptionPayload.object?.lastTransactionId;

              if (dependencies.hydrateTransactionOnSubscriptionPaid && lastTransactionId) {
                try {
                  const transaction = await hydrateTransaction(
                    dependencies.creem,
                    lastTransactionId
                  );
                  return mapSubscriptionPaidToPayment(subscriptionPayload, transaction);
                } catch (error) {
                  dependencies.logger.warn(
                    'Falling back to subscription product pricing after transaction hydration failure.',
                    {
                      error,
                      lastTransactionId,
                    }
                  );
                }
              }

              return mapSubscriptionPaidToPayment(subscriptionPayload);
            })();

    if (dependencies.dryRun) {
      dependencies.logger.info('Dry-run mode: payment not sent to DataFast.', {
        eventId,
        eventType,
        transactionId: normalizedPayload.transaction_id,
      });
      datafastResponse = { status: 200, body: { dryRun: true } };
    } else {
      datafastResponse = await dependencies.datafast.sendPayment(normalizedPayload);
    }
  } catch (error) {
    await releaseEvent(eventId, idempotencyStore);
    if (dependencies.onDeadLetter) {
      const err = error instanceof Error ? error : new Error(String(error));
      await dependencies.onDeadLetter({
        eventType,
        eventId,
        transactionId: normalizedPayload?.transaction_id ?? eventId,
        payment: normalizedPayload,
        error: err,
        attempts: (dependencies.retry?.retries ?? 1) + 1,
      });
    }
    throw error;
  }

  await completeEvent(eventId, idempotencyStore, dependencies.idempotencyProcessedTtlSeconds);

  return {
    ok: true,
    ignored: false,
    eventId,
    eventType,
    deduplicated: false,
    payload: normalizedPayload,
    datafastResponse,
  };
}
