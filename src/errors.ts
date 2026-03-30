export interface IDataFastRequestError {
  retryable: boolean;
  status: number;
  requestId?: string;
}

export class CreemDataFastError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreemDataFastError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class InvalidCreemSignatureError extends CreemDataFastError {
  constructor(message = 'Invalid webhook signature') {
    super(message);
    this.name = 'InvalidCreemSignatureError';
  }
}

export class MissingTrackingError extends CreemDataFastError {
  constructor(message = 'Missing datafast_visitor_id') {
    super(message);
    this.name = 'MissingTrackingError';
  }
}

export class DataFastRequestError extends CreemDataFastError implements IDataFastRequestError {
  retryable: boolean;
  status: number;
  requestId?: string;

  constructor(
    message: string,
    options: { retryable: boolean; status: number; requestId?: string }
  ) {
    super(message);
    this.name = 'DataFastRequestError';
    this.retryable = options.retryable;
    this.status = options.status;
    this.requestId = options.requestId;
  }
}

export class TrackingCollisionError extends CreemDataFastError {
  constructor(message = 'Tracking ID conflict detected') {
    super(message);
    this.name = 'TrackingCollisionError';
  }
}

export class UnsupportedEventError extends CreemDataFastError {
  constructor(message = 'Unsupported webhook event') {
    super(message);
    this.name = 'UnsupportedEventError';
  }
}
