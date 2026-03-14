export * from './creem.js';
export * from './datafast.js';

export type WebhookEventType = 'checkout.completed' | 'subscription.paid' | 'refund.created';

export interface CreemDataFastConfig {
  creemApiKey: string;
  datafastApiKey: string;
  cookieName?: string;
}

export interface WebhookHandlerOptions {
  creemApiKey: string;
  datafastApiKey: string;
  webhookSecret?: string;
  cookieName?: string;
  testMode?: boolean;
  timeoutMs?: number;
  retry?: RetryOptions;
  strictTracking?: boolean;
  idempotencyStore?: IdempotencyStore;
  logger?: Logger;
  onPaymentSuccess?: (data: {
    creemEvent: import('./creem.js').CreemWebhookEvent;
    datafastResponse: import('./datafast.js').DataFastPaymentResponse;
  }) => Promise<void> | void;
  onError?: (error: Error) => Promise<void> | void;
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface Logger {
  debug?: (message: string, ...args: unknown[]) => void;
  info?: (message: string, ...args: unknown[]) => void;
  warn?: (message: string, ...args: unknown[]) => void;
  error?: (message: string, ...args: unknown[]) => void;
}

export interface IdempotencyStore {
  has(id: string): Promise<boolean>;
  set(id: string, ttlSeconds?: number): Promise<void>;
}

export interface DataFastRequestError {
  retryable: boolean;
  status: number;
  requestId?: string;
}
