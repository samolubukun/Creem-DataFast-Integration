import { readTrackingFromCookieHeader } from '../infrastructure/http.js';
import type { BrowserTrackingResult } from '../foundation/types.js';

function resolveCookieSource(cookieSource?: string): string | undefined {
  if (cookieSource !== undefined) {
    return cookieSource;
  }
  if (typeof document === 'undefined') {
    return undefined;
  }
  return document.cookie;
}

export function getDataFastTracking(cookieSource?: string): BrowserTrackingResult {
  return readTrackingFromCookieHeader(resolveCookieSource(cookieSource));
}

export function appendDataFastTracking(
  inputUrl: string | URL,
  tracking: BrowserTrackingResult = getDataFastTracking()
): string {
  const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = inputUrl instanceof URL ? new URL(inputUrl.toString()) : new URL(inputUrl, base);

  if (tracking.visitorId) {
    url.searchParams.set('datafast_visitor_id', tracking.visitorId);
  }
  if (tracking.sessionId) {
    url.searchParams.set('datafast_session_id', tracking.sessionId);
  }

  if (typeof inputUrl === 'string' && inputUrl.startsWith('/')) {
    const query = url.searchParams.toString();
    return query ? `${url.pathname}?${query}` : url.pathname;
  }
  return url.toString();
}
