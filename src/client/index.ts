const DEFAULT_COOKIE_NAME = 'datafast_visitor_id';
const DEFAULT_SESSION_COOKIE_NAME = 'datafast_session_id';

export function getDataFastVisitorId(cookieName: string = DEFAULT_COOKIE_NAME): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === cookieName) {
      const value = valueParts.join('=');
      return value || null;
    }
  }
  
  return null;
}

export function getDataFastSessionId(cookieName: string = DEFAULT_SESSION_COOKIE_NAME): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === cookieName) {
      const value = valueParts.join('=');
      return value || null;
    }
  }
  
  return null;
}

export function hasDataFastVisitorId(cookieName: string = DEFAULT_COOKIE_NAME): boolean {
  return getDataFastVisitorId(cookieName) !== null;
}

export function buildCheckoutUrlWithVisitorId(
  checkoutUrl: string,
  visitorId: string | null,
  cookieName: string = DEFAULT_COOKIE_NAME
): string {
  if (!visitorId) {
    visitorId = getDataFastVisitorId(cookieName);
  }
  
  if (!visitorId) {
    return checkoutUrl;
  }
  
  const url = new URL(checkoutUrl);
  url.searchParams.set(cookieName, visitorId);
  
  return url.toString();
}

/**
 * Read the DataFast visitor ID from URL query parameters.
 * Useful as a fallback when cookies are not available (e.g. cross-origin
 * checkout redirects, server-side rendering, or email deep-links).
 *
 * @param urlOrSearch  A full URL string, a URLSearchParams instance, or a
 *                     raw query string like `"?datafast_visitor_id=abc"`.
 *                     Defaults to `window.location.search` when omitted.
 * @param paramName    Query parameter name (default: `"datafast_visitor_id"`)
 */
export function getVisitorIdFromUrl(
  urlOrSearch?: string | URLSearchParams,
  paramName: string = DEFAULT_COOKIE_NAME
): string | null {
  let params: URLSearchParams;

  if (urlOrSearch === undefined) {
    if (typeof window === 'undefined') return null;
    params = new URLSearchParams(window.location.search);
  } else if (typeof urlOrSearch === 'string') {
    try {
      // Full URL
      params = new URL(urlOrSearch).searchParams;
    } catch {
      // Bare query string
      params = new URLSearchParams(urlOrSearch);
    }
  } else {
    params = urlOrSearch;
  }

  return params.get(paramName);
}

/**
 * Returns the visitor ID from cookies first, then falls back to URL query
 * parameters.  This covers the common case where a user arrives from a link
 * that carries the ID in the URL before the DataFast cookie has been set.
 */
export function getVisitorIdWithFallback(
  cookieName: string = DEFAULT_COOKIE_NAME,
  urlOrSearch?: string | URLSearchParams
): string | null {
  return getDataFastVisitorId(cookieName) ?? getVisitorIdFromUrl(urlOrSearch, cookieName);
}

export function addTrackingToMetadata(
  metadata: Record<string, unknown> = {},
  visitorId?: string | null,
  sessionId?: string | null,
  visitorCookieName: string = DEFAULT_COOKIE_NAME,
  sessionCookieName: string = DEFAULT_SESSION_COOKIE_NAME
): Record<string, unknown> {
  const vid = visitorId ?? getDataFastVisitorId(visitorCookieName);
  const sid = sessionId ?? getDataFastSessionId(sessionCookieName);
  
  if (!vid && !sid) {
    return metadata;
  }
  
  return {
    ...metadata,
    ...(vid && { datafast_visitor_id: vid }),
    ...(sid && { datafast_session_id: sid }),
  };
}

export const addVisitorIdToMetadata = addTrackingToMetadata;

export const DataFastClient = {
  getVisitorId: getDataFastVisitorId,
  getSessionId: getDataFastSessionId,
  hasVisitorId: hasDataFastVisitorId,
  buildCheckoutUrl: buildCheckoutUrlWithVisitorId,
  addTrackingToMetadata,
  addToMetadata: addVisitorIdToMetadata,
  getVisitorIdFromUrl,
  getVisitorIdWithFallback,
};

export default DataFastClient;
