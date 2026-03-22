export class CreemDataFastError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CreemDataFastError';
  }
}

export class InvalidCreemSignatureError extends CreemDataFastError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidCreemSignatureError';
  }
}

export class MissingTrackingError extends CreemDataFastError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MissingTrackingError';
  }
}

export class MetadataCollisionError extends CreemDataFastError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MetadataCollisionError';
  }
}

export class UnsupportedWebhookEventError extends CreemDataFastError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'UnsupportedWebhookEventError';
  }
}

export class DataFastRequestError extends CreemDataFastError {
  public readonly status?: number;
  public readonly statusText?: string;
  public readonly requestId?: string;
  public readonly retryable: boolean;
  public readonly responseBody?: unknown;

  constructor(
    message: string,
    context: {
      status?: number;
      statusText?: string;
      requestId?: string;
      retryable: boolean;
      responseBody?: unknown;
    },
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'DataFastRequestError';
    this.status = context.status;
    this.statusText = context.statusText;
    this.requestId = context.requestId;
    this.retryable = context.retryable;
    this.responseBody = context.responseBody;
  }
}

export class TransactionHydrationError extends CreemDataFastError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TransactionHydrationError';
  }
}

export class WebhookValidationError extends CreemDataFastError {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'WebhookValidationError';
  }
}
