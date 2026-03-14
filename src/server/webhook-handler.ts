import * as crypto from 'node:crypto';
import type { WebhookHandlerOptions, CreemWebhookRaw } from '../types/index.js';
import type { DataFastPaymentResponse } from '../types/datafast.js';
import { mapCreemEventToDataFast, mapToDataFastPaymentRequest } from '../utils/map-payment.js';

const DATAFAST_API_URL = 'https://datafa.st/api/v1/payments';

export class WebhookHandler {
  private webhookSecret?: string;
  private datafastApiKey: string;
  private onPaymentSuccess?: WebhookHandlerOptions['onPaymentSuccess'];
  private onError?: WebhookHandlerOptions['onError'];

  constructor(options: WebhookHandlerOptions) {
    this.webhookSecret = options.webhookSecret;
    this.datafastApiKey = options.datafastApiKey;
    this.onPaymentSuccess = options.onPaymentSuccess;
    this.onError = options.onError;
  }

  /**
   * Process an incoming CREEM webhook.
   *
   * @param rawBody  The raw request body as a string (needed for signature verification).
   * @param signature  The value of the `creem-signature` header.
   */
  async handleWebhook(
    rawBody: string,
    signature?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Verify signature (if a webhook secret was provided)
      if (this.webhookSecret) {
        if (!signature) {
          return { success: false, message: 'Missing creem-signature header' };
        }
        if (!this.verifySignature(rawBody, signature)) {
          return { success: false, message: 'Invalid webhook signature' };
        }
      }

      // 2. Parse
      const raw = JSON.parse(rawBody) as CreemWebhookRaw;

      // 3. Only handle the two event types we care about
      if (!this.isSupportedEvent(raw.eventType)) {
        return { success: true, message: `Event type "${raw.eventType}" ignored` };
      }

      // 4. Map to internal format
      const mappedData = mapCreemEventToDataFast(raw);
      if (!mappedData) {
        return { success: true, message: 'No payment data to forward' };
      }

      // 5. Build DataFast request
      const datafastRequest = mapToDataFastPaymentRequest(mappedData);

      // 6. Send to DataFast
      const response = await this.sendToDataFast(datafastRequest);

      // 7. Success callback
      if (this.onPaymentSuccess) {
        // Re-parse so the callback gets the typed event
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

  // ---------- Signature verification (HMAC-SHA256) ----------

  private verifySignature(payload: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret!)
      .update(payload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex')
      );
    } catch {
      // If the signature has an unexpected length, timingSafeEqual throws
      return false;
    }
  }

  private isSupportedEvent(eventType: string): boolean {
    return eventType === 'checkout.completed' || eventType === 'subscription.paid';
  }

  // ---------- DataFast API call ----------

  private async sendToDataFast(
    payment: Parameters<typeof JSON.stringify>[0]
  ): Promise<DataFastPaymentResponse> {
    const response = await fetch(DATAFAST_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.datafastApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payment),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`DataFast API error (${response.status}): ${body}`);
    }

    return response.json() as Promise<DataFastPaymentResponse>;
  }
}

export function createWebhookHandler(options: WebhookHandlerOptions): WebhookHandler {
  return new WebhookHandler(options);
}

export default WebhookHandler;
