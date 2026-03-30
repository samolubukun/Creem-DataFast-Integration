import * as crypto from 'node:crypto';
import type { WebhookHandlerOptions, CreemWebhookRaw, Logger, IdempotencyStore } from '../types/index.js';
import type { DataFastPaymentResponse } from '../types/datafast.js';
import { mapCreemEventToDataFast, mapToDataFastPaymentRequest } from '../utils/map-payment.js';
import { createMemoryIdempotencyStore } from '../utils/idempotency.js';
import { DataFastRequestError as DFError } from '../errors.js';

const DATAFAST_API_URL = 'https://datafa.st/api/v1/payments';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 1;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 2000;

export class WebhookHandler {
  private webhookSecret?: string;
  private datafastApiKey: string;
  private testMode: boolean;
  private timeoutMs: number;
  private retryRetries: number;
  private retryBaseDelayMs: number;
  private retryMaxDelayMs: number;
  private strictTracking: boolean;
  private idempotencyStore: IdempotencyStore;
  private logger: Logger;
  private onPaymentSuccess?: WebhookHandlerOptions['onPaymentSuccess'];
  private onError?: WebhookHandlerOptions['onError'];

  constructor(options: WebhookHandlerOptions) {
    this.webhookSecret = options.webhookSecret;
    this.datafastApiKey = options.datafastApiKey;
    this.testMode = options.testMode ?? false;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryRetries = options.retry?.retries ?? DEFAULT_RETRIES;
    this.retryBaseDelayMs = options.retry?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.retryMaxDelayMs = options.retry?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.strictTracking = options.strictTracking ?? false;
    this.idempotencyStore = options.idempotencyStore ?? createMemoryIdempotencyStore();
    this.logger = options.logger ?? createDefaultLogger();
    this.onPaymentSuccess = options.onPaymentSuccess;
    this.onError = options.onError;
  }

  async handleWebhook(
    rawBody: string,
    signature?: string
  ): Promise<{ success: boolean; message: string; ignored?: boolean }> {
    try {
      if (this.webhookSecret) {
        if (!signature) {
          return { success: false, message: 'Missing creem-signature header' };
        }
        if (!this.verifySignature(rawBody, signature)) {
          return { success: false, message: 'Invalid webhook signature' };
        }
      }

      const raw = JSON.parse(rawBody) as CreemWebhookRaw;

      const alreadyProcessed = await this.idempotencyStore.has(raw.id);
      if (alreadyProcessed) {
        this.logger.debug?.(`Webhook ${raw.id} already processed, skipping`);
        return { success: true, message: 'Already processed', ignored: true };
      }

      if (!this.isSupportedEvent(raw.eventType)) {
        return { success: true, message: `Event type "${raw.eventType}" ignored`, ignored: true };
      }

      const mappedData = mapCreemEventToDataFast(raw);
      if (!mappedData) {
        return { success: true, message: 'No payment data to forward' };
      }

      if (this.strictTracking && !mappedData.visitorId) {
        throw new Error('Missing datafast_visitor_id');
      }

      const datafastRequest = mapToDataFastPaymentRequest(mappedData);

      const response = await this.sendToDataFastWithRetry(datafastRequest as unknown as Record<string, unknown>);

      await this.idempotencyStore.set(raw.id);

      if (this.onPaymentSuccess) {
        const event = JSON.parse(rawBody);
        await this.onPaymentSuccess({
          creemEvent: event,
          datafastResponse: response,
        });
      }

      return { success: true, message: 'Payment forwarded to DataFast' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (this.onError) {
        await this.onError(error instanceof Error ? error : new Error(errorMessage));
      }

      return { success: false, message: errorMessage };
    }
  }

  verifySignature(payload: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret!)
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex')
      );
    } catch {
      return false;
    }
  }

  private isSupportedEvent(eventType: string): boolean {
    return (
      eventType === 'checkout.completed' ||
      eventType === 'subscription.paid' ||
      eventType === 'refund.created'
    );
  }

  private async sendToDataFastWithRetry(
    payment: Record<string, unknown>
  ): Promise<DataFastPaymentResponse> {
    let lastError: Error | null = null;
    const maxAttempts = this.retryRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this.sendToDataFast(payment);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || attempt === maxAttempts - 1) {
          throw error;
        }

        const delay = Math.min(
          this.retryBaseDelayMs * Math.pow(2, attempt),
          this.retryMaxDelayMs
        );

        this.logger.warn?.(`DataFast request failed, retrying in ${delay}ms`, {
          attempt: attempt + 1,
          maxAttempts,
          error: lastError.message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof DFError) {
      return error.retryable;
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true;
    }
    return false;
  }

  private async sendToDataFast(
    payment: Record<string, unknown>
  ): Promise<DataFastPaymentResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const baseUrl = this.testMode
        ? 'https://test-api.datafa.st/api/v1/payments'
        : DATAFAST_API_URL;

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.datafastApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payment),
        signal: controller.signal,
      });

      if (!response.ok) {
        const status = response.status;
        const body = await response.text();
        const retryable = status === 408 || status === 429 || status >= 500;

        throw new DFError(`DataFast API error (${status}): ${body}`, {
          retryable,
          status,
        });
      }

      return response.json() as Promise<DataFastPaymentResponse>;
    } catch (error) {
      if (error instanceof DFError) throw error;

      const message = error instanceof Error ? error.message : 'Unknown error';
      const retryable = message.includes('aborted') || message.includes('fetch');

      throw new DFError(message, { retryable, status: 0 });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function createWebhookHandler(options: WebhookHandlerOptions): WebhookHandler {
  return new WebhookHandler(options);
}

function createDefaultLogger(): Logger {
  return {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };
}

export default WebhookHandler;
