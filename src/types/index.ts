export * from './creem.js';
export * from './datafast.js';

export type WebhookEventType = 'checkout.completed' | 'subscription.paid';

export interface CreemDataFastConfig {
  creemApiKey: string;
  datafastApiKey: string;
  cookieName?: string;
}

export interface WebhookHandlerOptions {
  creemApiKey: string;
  datafastApiKey: string;
  /** CREEM webhook secret for HMAC-SHA256 signature verification. */
  webhookSecret?: string;
  cookieName?: string;
  onPaymentSuccess?: (data: {
    creemEvent: import('./creem.js').CreemWebhookEvent;
    datafastResponse: import('./datafast.js').DataFastPaymentResponse;
  }) => Promise<void> | void;
  onError?: (error: Error) => Promise<void> | void;
}
