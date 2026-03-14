// ---------------------------------------------------------------------------
// CREEM Webhook payload types — derived from the actual CREEM webhook docs
// https://docs.creem.io/code/webhooks
// ---------------------------------------------------------------------------

/** Nested product object inside a webhook payload. */
export interface CreemWebhookProduct {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  price: number;          // cents
  currency: string;
  billing_type: 'one_time' | 'recurring';
  billing_period?: string; // e.g. "every-month"
  status: string;
  tax_mode: string;
  tax_category: string;
  default_success_url: string;
  created_at: string;
  updated_at: string;
  mode: string;
}

/** Nested customer object inside a webhook payload. */
export interface CreemWebhookCustomer {
  id: string;
  object: 'customer';
  email: string;
  name: string;
  country: string;
  created_at: string;
  updated_at: string;
  mode: string;
}

/** Nested order object inside a checkout.completed webhook. */
export interface CreemWebhookOrder {
  id: string;
  customer: string;
  product: string;
  amount: number;         // cents
  currency: string;
  status: string;
  type: string;           // "one_time" | "recurring"
  created_at: string;
  updated_at: string;
  mode: string;
}

/** Nested subscription object inside a checkout.completed webhook. */
export interface CreemWebhookSubscription {
  id: string;
  object: 'subscription';
  product: string | CreemWebhookProduct;
  customer: string | CreemWebhookCustomer;
  collection_method: string;
  status: string;
  last_transaction_id?: string;
  last_transaction_date?: string;
  next_transaction_date?: string;
  current_period_start_date?: string;
  current_period_end_date?: string;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
  mode: string;
}

// ---- checkout.completed ----

export interface CreemCheckoutCompletedObject {
  id: string;
  object: 'checkout';
  request_id?: string;
  order: CreemWebhookOrder;
  product: CreemWebhookProduct;
  customer: CreemWebhookCustomer;
  subscription?: CreemWebhookSubscription;
  custom_fields: unknown[];
  status: string;
  metadata?: Record<string, unknown>;
  mode: string;
}

export interface CreemCheckoutCompletedEvent {
  id: string;
  eventType: 'checkout.completed';
  created_at: number;
  object: CreemCheckoutCompletedObject;
}

// ---- subscription.paid ----

export interface CreemSubscriptionPaidObject {
  id: string;
  object: 'subscription';
  product: CreemWebhookProduct;
  customer: CreemWebhookCustomer;
  collection_method: string;
  status: string;
  last_transaction_id?: string;
  last_transaction_date?: string;
  next_transaction_date?: string;
  current_period_start_date?: string;
  current_period_end_date?: string;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
  mode: string;
}

export interface CreemSubscriptionPaidEvent {
  id: string;
  eventType: 'subscription.paid';
  created_at: number;
  object: CreemSubscriptionPaidObject;
}

// ---- refund.created ----

export interface CreemRefundCreatedObject {
  id: string;
  object: 'refund';
  order: CreemWebhookOrder;
  product: CreemWebhookProduct;
  customer: CreemWebhookCustomer;
  amount: number;
  status: string;
  reason?: string;
  created_at: string;
  updated_at: string;
  mode: string;
  metadata?: Record<string, unknown>;
}

export interface CreemRefundCreatedEvent {
  id: string;
  eventType: 'refund.created';
  created_at: number;
  object: CreemRefundCreatedObject;
}

// ---- Union type for the events this package handles ----

export type CreemWebhookEvent =
  | CreemCheckoutCompletedEvent
  | CreemSubscriptionPaidEvent
  | CreemRefundCreatedEvent;

/** Raw webhook envelope before we know the eventType. */
export interface CreemWebhookRaw {
  id: string;
  eventType: string;
  created_at: number;
  object: Record<string, unknown>;
}

// ---- SDK checkout creation (used by our wrapper) ----

export interface CreemCheckoutCreateOptions {
  productId: string;
  units?: number;
  discountCode?: string;
  customer?: {
    email?: string;
    name?: string;
  };
  customFields?: Array<{
    key: string;
    label: string;
    type: string;
    optional?: boolean;
  }>;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CreemConfig {
  apiKey: string;
  serverIdx?: 0 | 1;
}
