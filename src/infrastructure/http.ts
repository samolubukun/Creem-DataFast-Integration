import type { HeadersLike } from '../foundation/types.js';

/**
 * Safely extracts a header value from various header object formats.
 */
export function getHeaderValue(headers: HeadersLike | undefined, name: string): string | undefined {
  if (!headers) return undefined;

  const normalized = name.toLowerCase();

  if (typeof headers.get === 'function') {
    return headers.get(normalized) ?? undefined;
  }

  // Handle Record<string, string | string[]>
  const value = (headers as any).headers?.[normalized] ?? (headers as any)[normalized];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value as string | undefined;
}

/**
 * Reads DataFast tracking IDs from a cookie header string.
 */
export function readTrackingFromCookieHeader(cookieHeader?: string) {
  if (!cookieHeader) return { visitorId: undefined, sessionId: undefined };

  const visitorMatch = cookieHeader.match(/datafast_visitor_id=([^;]+)/);
  const sessionMatch = cookieHeader.match(/datafast_session_id=([^;]+)/);

  return {
    visitorId: visitorMatch ? decodeURIComponent(visitorMatch[1]) : undefined,
    sessionId: sessionMatch ? decodeURIComponent(sessionMatch[1]) : undefined,
  };
}
