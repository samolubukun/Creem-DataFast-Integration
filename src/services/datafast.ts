import { DataFastRequestError } from '../foundation/errors.js';
import { resolveLogger } from '../foundation/logger.js';
import type {
  CreemDataFastOptions,
  DataFastApiResponse,
  DataFastPaymentPayload,
  InternalDataFastClient,
  RetryConfig,
} from '../foundation/types.js';

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 2_000;
const MAX_ERROR_BODY_LENGTH = 1_024;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function resolveFetch(fetchImplementation?: typeof globalThis.fetch): typeof globalThis.fetch {
  const resolved = fetchImplementation ?? globalThis.fetch;

  if (!resolved) {
    throw new DataFastRequestError('Fetch implementation is required to call DataFast.', {
      retryable: false,
    });
  }

  return resolved;
}

function parseResponseBody(body: string): unknown {
  if (!body) {
    return undefined;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function truncateString(value: string): string {
  if (value.length <= MAX_ERROR_BODY_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_ERROR_BODY_LENGTH)}...[truncated]`;
}

function sanitizeResponseBody(body: unknown): unknown {
  if (body === undefined) {
    return undefined;
  }

  if (typeof body === 'string') {
    return truncateString(body);
  }

  try {
    const serialized = JSON.stringify(body);

    if (serialized.length <= MAX_ERROR_BODY_LENGTH) {
      return body;
    }

    return truncateString(serialized);
  } catch {
    return '[unserializable response body]';
  }
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.floor(value);
}

function resolveRetryConfig(retry?: RetryConfig): Required<RetryConfig> {
  return {
    retries: normalizePositiveInteger(retry?.retries, DEFAULT_RETRIES),
    baseDelayMs: normalizePositiveInteger(retry?.baseDelayMs, DEFAULT_BASE_DELAY_MS),
    maxDelayMs: normalizePositiveInteger(retry?.maxDelayMs, DEFAULT_MAX_DELAY_MS),
  };
}

function resolveTimeoutMs(timeoutMs: number | undefined): number {
  return normalizePositiveInteger(timeoutMs, DEFAULT_TIMEOUT_MS);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function getRequestId(response: Response): string | undefined {
  return (
    response.headers.get('x-request-id') ??
    response.headers.get('request-id') ??
    response.headers.get('x-datafast-request-id') ??
    undefined
  );
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

function computeDelayMs(attempt: number, retry: Required<RetryConfig>): number {
  return Math.min(retry.baseDelayMs * 2 ** attempt + Math.random() * 100, retry.maxDelayMs);
}

async function sleep(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function normalizeBaseUrl(baseUrl?: string): string {
  if (!baseUrl) {
    return 'https://datafa.st';
  }
  return baseUrl.replace(/\/$/, '');
}

export function createDataFastClient(options: CreemDataFastOptions): InternalDataFastClient {
  const fetchImplementation = resolveFetch(options.fetch);
  const logger = resolveLogger(options.logger);
  const timeoutMs = resolveTimeoutMs(options.timeoutMs);
  const retry = resolveRetryConfig(options.retry);
  const baseUrl = normalizeBaseUrl(options.datafastApiBaseUrl);
  const paymentsUrl = `${baseUrl}/api/v1/payments`;

  const sendPayment = async (payload: DataFastPaymentPayload) => {
      for (let attempt = 0; attempt <= retry.retries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetchImplementation(paymentsUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${options.datafastApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          const responseText = await response.text();
          const responseBody = sanitizeResponseBody(parseResponseBody(responseText));

          if (response.ok) {
            return responseBody;
          }

          const retryable = isRetryableStatus(response.status);
          const error = new DataFastRequestError(
            `DataFast request failed with status ${response.status}.`,
            {
              status: response.status,
              statusText: response.statusText,
              requestId: getRequestId(response),
              retryable,
              responseBody,
            }
          );

          if (retryable && attempt < retry.retries) {
            logger.warn('Retrying DataFast request after retryable response.', {
              attempt: attempt + 1,
              nextAttempt: attempt + 2,
              requestId: error.requestId,
              status: error.status,
              statusText: error.statusText,
            });
            await sleep(computeDelayMs(attempt, retry));
            continue;
          }

          throw error;
        } catch (error) {
          const retryable = isAbortError(error) || !(error instanceof DataFastRequestError);

          if (retryable && attempt < retry.retries) {
            logger.warn('Retrying DataFast request after transport failure.', {
              attempt: attempt + 1,
              nextAttempt: attempt + 2,
              reason: isAbortError(error) ? 'timeout' : 'network_error',
            });
            await sleep(computeDelayMs(attempt, retry));
            continue;
          }

          if (error instanceof DataFastRequestError) {
            throw error;
          }

          if (isAbortError(error)) {
            logger.warn('DataFast request timed out.', {
              attempts: attempt + 1,
              timeoutMs,
            });
            throw new DataFastRequestError(
              `DataFast request timed out after ${timeoutMs}ms.`,
              {
                retryable: true,
              },
              { cause: error }
            );
          }

          throw new DataFastRequestError(
            'DataFast request failed due to a network error.',
            {
              retryable: true,
            },
            { cause: error instanceof Error ? error : undefined }
          );
        } finally {
          clearTimeout(timeout);
        }
      }

      throw new DataFastRequestError('DataFast request failed unexpectedly.', {
        retryable: false,
      });
    };

  return {
    async sendPayment(payload: DataFastPaymentPayload) {
      return sendPayment(payload);
    },
    async sendPayments(payloads: DataFastPaymentPayload[]) {
      const results: Array<{ ok: boolean; response?: DataFastApiResponse; error?: Error }> = [];

      for (const payload of payloads) {
        try {
          const body = await sendPayment(payload);
          results.push({ ok: true, response: { status: 200, body } });
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          results.push({ ok: false, error: err });
        }
      }

      return { results };
    },
    async getPayments(visitorId: string): Promise<DataFastApiResponse> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const url = `${baseUrl}/api/v1/payments?visitor_id=${encodeURIComponent(visitorId)}`;

      try {
        const response = await fetchImplementation(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${options.datafastApiKey}`,
          },
          signal: controller.signal,
        });

        const responseText = await response.text();
        const responseBody = parseResponseBody(responseText);

        if (!response.ok) {
          throw new DataFastRequestError(
            `DataFast getPayments failed with status ${response.status}.`,
            {
              status: response.status,
              statusText: response.statusText,
              requestId: getRequestId(response),
              retryable: isRetryableStatus(response.status),
              responseBody: sanitizeResponseBody(responseBody),
            }
          );
        }

        return {
          status: response.status,
          body: responseBody,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
