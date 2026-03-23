import type { Creem } from 'creem';

export interface DataFastTracking {
  visitorId?: string;
  sessionId?: string;
}

export interface HeadersLike {
  get?(name: string): string | null | undefined;
  [key: string]: any;
}

export interface CreemSdkClientLike {
  checkouts: {
    create(params: any): Promise<any>;
  };
  transactions: {
    getById(id: string): Promise<any>;
  };
}

export interface InternalCreateCheckoutRequest {
  productId: string;
  successUrl: string;
  requestId?: string;
  units?: number;
  discountCode?: string;
  customer?: string | Record<string, any>;
  customFields?: Record<string, any>;
  metadata?: Record<string, any> | null;
}

export interface InternalCreemClient {
  createCheckout(request: InternalCreateCheckoutRequest): Promise<any>;
  getTransactionById(transactionId: string): Promise<any>;
}

export interface DataFastPaymentPayload {
  amount: number;
  currency: string;
  transaction_id: string;
  renewal: boolean;
  customer_id?: string;
  datafast_visitor_id?: string;
  email?: string;
  name?: string;
  timestamp?: string;
  refunded?: boolean;
}

export interface RetryConfig {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface DeadLetterContext {
  eventType: string;
  eventId: string;
  transactionId: string;
  payment?: DataFastPaymentPayload;
  error: Error;
  attempts: number;
}

export interface DataFastApiResponse {
  status: number;
  body: unknown;
}

export interface HealthCheckResult {
  ok: boolean;
  /**
   * @deprecated Use `ok` instead. Kept for backwards compatibility.
   */
  healthy: boolean;
  checks: {
    creemApiKey: { ok: boolean; message: string; latencyMs?: number };
    webhookSecret: { ok: boolean; message: string; latencyMs?: number };
    datafastApi: { ok: boolean; message: string; latencyMs?: number };
  };
  timestamp: string;
}

export type MetadataMergeStrategy = 'preserve' | 'overwrite' | 'error';

export interface CreemDataFastOptions {
  creemApiKey?: string;
  creemWebhookSecret: string;
  datafastApiKey: string;
  datafastApiBaseUrl?: string;
  testMode?: boolean;
  creemClient?: CreemSdkClientLike;
  fetch?: typeof globalThis.fetch;
  logger?: LoggerLike;
  timeoutMs?: number;
  retry?: RetryConfig;
  strictTracking?: boolean;
  captureSessionId?: boolean;
  webhookDryRun?: boolean;
  /**
   * @deprecated Use `webhookDryRun` instead. Kept for backwards compatibility.
   */
  dryRun?: boolean;
  eventFilter?: SupportedWebhookEvent[];
  onDeadLetter?: (context: DeadLetterContext) => void | Promise<void>;
  hydrateTransactionOnSubscriptionPaid?: boolean;
  idempotencyStore?: IdempotencyStore;
  idempotencyInFlightTtlSeconds?: number;
  idempotencyProcessedTtlSeconds?: number;
}

export interface LoggerLike {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface IdempotencyStore {
  claim(key: string, ttlSeconds?: number): Promise<boolean>;
  complete(key: string, ttlSeconds?: number): Promise<void>;
  release(key: string): Promise<void>;
}

export interface BrowserTrackingResult {
  visitorId?: string;
  sessionId?: string;
}

export interface CreateCheckoutParams {
  productId: string;
  successUrl: string;
  requestId?: string;
  units?: number;
  discountCode?: string;
  customer?: string | Record<string, any>;
  customFields?: Record<string, any>;
  metadata?: Record<string, any> | null;
  tracking?: DataFastTracking;
  mergeStrategy?: MetadataMergeStrategy;
}

export interface CreateCheckoutContext {
  request?: {
    headers: HeadersLike;
    url?: string;
  };
  cookieHeader?: string;
  strictTracking?: boolean;
}

export interface CreateCheckoutResult {
  checkoutId: string;
  checkoutUrl: string;
  injectedTracking: DataFastTracking;
  finalMetadata: Record<string, any> | null;
  raw: any;
}

export interface HandleWebhookParams {
  rawBody: string;
  headers: HeadersLike;
}

export interface HandleWebhookResult {
  ok: boolean;
  ignored: boolean;
  eventId?: string;
  eventType?: string;
  reason?: 'unsupported_event' | 'duplicate_event' | 'delegated_to_subscription_paid';
  deduplicated?: boolean;
  payload?: DataFastPaymentPayload;
  datafastResponse?: DataFastApiResponse | unknown;
}

export interface CheckoutDependencies {
  creem: InternalCreemClient;
  logger: LoggerLike;
  captureSessionId: boolean;
  strictTracking: boolean;
}

export type SupportedWebhookEvent = 'checkout.completed' | 'subscription.paid' | 'refund.created';

export interface WebhookHandlerDependencies {
  creemWebhookSecret: string;
  datafast: InternalDataFastClient;
  creem: InternalCreemClient;
  idempotencyStore: IdempotencyStore;
  idempotencyInFlightTtlSeconds: number;
  idempotencyProcessedTtlSeconds: number;
  eventFilter?: SupportedWebhookEvent[];
  webhookDryRun?: boolean;
  /**
   * @deprecated Use `webhookDryRun` instead. Kept for backwards compatibility.
   */
  dryRun?: boolean;
  onDeadLetter?: (context: DeadLetterContext) => void | Promise<void>;
  retry?: RetryConfig;
  hydrateTransactionOnSubscriptionPaid: boolean;
  logger: LoggerLike;
}

export interface InternalDataFastClient {
  sendPayment(payload: DataFastPaymentPayload): Promise<any>;
  sendPayments?(
    payloads: DataFastPaymentPayload[]
  ): Promise<{ results: Array<{ ok: boolean; response?: DataFastApiResponse; error?: Error }> }>;
  getPayments?(visitorId: string): Promise<DataFastApiResponse>;
}

export interface CheckoutCompletedEvent {
  id: string;
  eventType?: string;
  event_type?: string;
  object?: {
    order?: {
      id: string;
      amount: number;
      currency: string;
      type?: string;
      metadata?: Record<string, any>;
    };
    customer?:
      | string
      | {
          id?: string;
          email?: string;
          name?: string;
        };
    metadata?: Record<string, any>;
    subscription?: string | { id?: string };
  };
}

export interface SubscriptionPaidEvent {
  id: string;
  eventType?: string;
  event_type?: string;
  object?: {
    customer?:
      | string
      | {
          id?: string;
          email?: string;
          name?: string;
        };
    metadata?: Record<string, any>;
    product?: {
      price?: number;
      currency?: string;
    };
    last_transaction_id?: string;
    lastTransactionId?: string;
    last_transaction_date?: string;
    lastTransactionDate?: string;
  };
}

export interface RefundCreatedEvent {
  id: string;
  eventType?: string;
  event_type?: string;
  created_at?: number | string;
  createdAt?: number | string;
  object?: {
    id?: string;
    refund_amount?: number;
    refundAmount?: number;
    refund_currency?: string;
    refundCurrency?: string;
    customer?:
      | string
      | {
          id?: string;
          email?: string;
          name?: string;
        };
    metadata?: Record<string, any>;
    created_at?: number | string;
    createdAt?: number | string;
    transaction?: {
      id?: string;
      subscription?: string | null;
      type?: string;
      metadata?: Record<string, any>;
      created_at?: number | string;
      createdAt?: number | string;
      customer?:
        | string
        | {
            id?: string;
            email?: string;
            name?: string;
          };
    };
  };
}

export interface NormalizedTransaction {
  id: string;
  amount: number;
  currency: string;
  timestamp?: string;
}

export interface CheckoutMetadata {
  datafast_visitor_id?: string;
  datafast_session_id?: string;
  [key: string]: any;
}

export interface CheckoutCompletedCustomer {
  id?: string;
  email?: string;
  name?: string;
}

export interface SubscriptionPaidCustomer {
  id?: string;
  email?: string;
  name?: string;
}

export interface RefundCreatedCustomer {
  id?: string;
  email?: string;
  name?: string;
}

export interface CreemDataFastClient {
  createCheckout(
    params: CreateCheckoutParams,
    context?: CreateCheckoutContext
  ): Promise<CreateCheckoutResult>;
  handleWebhook(params: HandleWebhookParams): Promise<HandleWebhookResult>;
  replayWebhook(params: HandleWebhookParams): Promise<HandleWebhookResult>;
  verifyWebhookSignature(rawBody: string, headers: HeadersLike): Promise<boolean>;
  buildCheckoutUrl(params: {
    checkoutUrl: string;
    visitorId?: string;
    sessionId?: string;
    mergeStrategy?: MetadataMergeStrategy;
  }): string;
  healthCheck(): Promise<HealthCheckResult>;
  sendPayments(
    payloads: DataFastPaymentPayload[]
  ): Promise<{ results: Array<{ ok: boolean; response?: DataFastApiResponse; error?: Error }> }>;
  getPayments(visitorId: string): Promise<DataFastApiResponse>;
  creem: InternalCreemClient;
}

export interface NextWebhookHandlerOptions {
  onError?(error: unknown): void | Promise<void>;
}

export interface ExpressLikeRequest {
  body: string | Buffer;
  headers: Record<string, string | string[] | undefined>;
}

export interface ExpressLikeResponse {
  status(code: number): ExpressLikeResponse;
  send(body: any): ExpressLikeResponse;
}

export interface ExpressWebhookHandlerOptions {
  onError?(error: unknown): void | Promise<void>;
}
